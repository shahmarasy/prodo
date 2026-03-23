import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { installAgentCommands, type SupportedAi } from "./agent-command-installer";
import { listArtifactDefinitions } from "./artifact-registry";
import { ensureDir, fileExists } from "./utils";
import { briefPath, outputDirPath, outputIndexPath, prodoPath } from "./paths";
import { applyConfiguredPresets } from "./preset-loader";
import { syncRegistry } from "./registry";
import { writeSettings } from "./settings";
import { buildWorkflowCommands } from "./workflow-commands";
import {
  NORMALIZED_BRIEF_TEMPLATE,
  NORMALIZE_PROMPT_TEMPLATE,
  START_BRIEF_TEMPLATE,
  HOOKS_TEMPLATE,
  artifactTemplateTemplate,
  commandTemplate,
  promptTemplate,
  schemaTemplate
} from "./templates";

type AssetManifestItem = {
  source: string;
  target: string;
  source_sha256: string;
  target_sha256: string | null;
  status: "match" | "drift" | "missing" | "protected" | "updated" | "unmanaged";
};

type ScaffoldManifest = {
  schema_version: "1.0";
  generated_at: string;
  prodo_version: string;
  copied_asset_count: number;
  copied_assets: Array<{ source: string; target: string; sha256: string }>;
  asset_count: number;
  parity_summary: {
    match_count: number;
    drift_count: number;
    missing_count: number;
    protected_count: number;
    updated_count: number;
    unmanaged_count: number;
  };
  assets: AssetManifestItem[];
};

type SourceTargetPair = { sourceDir: string; targetDir: string };
type BackupMap = Map<string, Buffer | null>;

function templateFileName(artifactType: string): string {
  if (artifactType === "workflow") return `${artifactType}.mmd`;
  if (artifactType === "wireframe") return `${artifactType}.html`;
  return `${artifactType}.md`;
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  if (await fileExists(filePath)) return;
  await fs.writeFile(filePath, content, "utf8");
}

async function readProdoVersion(cwd: string): Promise<string> {
  const candidates = [
    path.join(cwd, "package.json"),
    path.resolve(__dirname, "..", "package.json")
  ];
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, "utf8")) as { version?: string };
      if (typeof parsed.version === "string" && parsed.version.trim().length > 0) return parsed.version;
    } catch {
      // ignore and continue
    }
  }
  return "0.0.0-dev";
}

async function fileSha256(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  if (!(await fileExists(rootDir))) return [];
  const out: string[] = [];
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  };
  await walk(rootDir);
  return out;
}

async function loadPreviousManifest(root: string): Promise<ScaffoldManifest | null> {
  const manifestPath = path.join(root, "scaffold-manifest.json");
  if (!(await fileExists(manifestPath))) return null;
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Partial<ScaffoldManifest>;
    if (!Array.isArray(parsed.assets)) return null;
    return {
      schema_version: "1.0",
      generated_at: parsed.generated_at ?? "",
      prodo_version: parsed.prodo_version ?? "0.0.0-dev",
      copied_asset_count: Number(parsed.copied_asset_count ?? 0),
      copied_assets: Array.isArray(parsed.copied_assets) ? parsed.copied_assets : [],
      asset_count: Number(parsed.asset_count ?? 0),
      parity_summary: {
        match_count: Number(parsed.parity_summary?.match_count ?? 0),
        drift_count: Number(parsed.parity_summary?.drift_count ?? 0),
        missing_count: Number(parsed.parity_summary?.missing_count ?? 0),
        protected_count: Number(parsed.parity_summary?.protected_count ?? 0),
        updated_count: Number(parsed.parity_summary?.updated_count ?? 0),
        unmanaged_count: Number(parsed.parity_summary?.unmanaged_count ?? 0)
      },
      assets: parsed.assets as AssetManifestItem[]
    };
  } catch {
    return null;
  }
}

async function copyDirIfMissing(
  sourceDir: string,
  targetDir: string,
  copiedAssets: Array<{ source: string; target: string; sha256: string }>
): Promise<void> {
  if (!(await fileExists(sourceDir))) return;
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirIfMissing(src, dst, copiedAssets);
      continue;
    }
    if (await fileExists(dst)) continue;
    await fs.copyFile(src, dst);
    copiedAssets.push({
      source: src,
      target: dst,
      sha256: await fileSha256(dst)
    });
  }
}

async function refreshLegacyCommandTemplates(sourceDir: string, targetDir: string): Promise<void> {
  if (!(await fileExists(sourceDir)) || !(await fileExists(targetDir))) return;
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith("prodo-") || !entry.name.endsWith(".md")) continue;
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (!(await fileExists(dst))) continue;
    const existing = await fs.readFile(dst, "utf8");
    const isLegacyRunMode = /run:\s*\n\s*action:\s*[^\n]+/m.test(existing) || /mode:\s*internal-runtime/m.test(existing);
    if (!isLegacyRunMode) continue;
    await fs.copyFile(src, dst);
  }
}

async function buildAssetManifest(
  pairs: SourceTargetPair[],
  previous: ScaffoldManifest | null,
  backup: BackupMap
): Promise<AssetManifestItem[]> {
  const previousByTarget = new Map<string, AssetManifestItem>();
  for (const item of previous?.assets ?? []) {
    previousByTarget.set(path.resolve(item.target), item);
  }

  const items: AssetManifestItem[] = [];
  for (const pair of pairs) {
    const sourceFiles = await listFilesRecursive(pair.sourceDir);
    for (const sourceFile of sourceFiles) {
      const relative = path.relative(pair.sourceDir, sourceFile);
      const targetFile = path.join(pair.targetDir, relative);
      const resolvedTarget = path.resolve(targetFile);
      const sourceHash = await fileSha256(sourceFile);
      const targetExists = await fileExists(targetFile);

      if (!targetExists) {
        await ensureDir(path.dirname(targetFile));
        backup.set(resolvedTarget, null);
        await fs.copyFile(sourceFile, targetFile);
        items.push({
          source: sourceFile,
          target: targetFile,
          source_sha256: sourceHash,
          target_sha256: await fileSha256(targetFile),
          status: "missing"
        });
        continue;
      }

      const currentTargetHash = await fileSha256(targetFile);
      const prev = previousByTarget.get(resolvedTarget);
      const prevTargetHash = prev?.target_sha256 ?? null;
      const prevSourceHash = prev?.source_sha256 ?? null;

      if (currentTargetHash === sourceHash) {
        items.push({
          source: sourceFile,
          target: targetFile,
          source_sha256: sourceHash,
          target_sha256: currentTargetHash,
          status: "match"
        });
        continue;
      }

      if (prev && prevTargetHash && prevSourceHash && currentTargetHash === prevTargetHash && prevSourceHash !== sourceHash) {
        if (!backup.has(resolvedTarget)) {
          backup.set(resolvedTarget, await fs.readFile(targetFile));
        }
        await fs.copyFile(sourceFile, targetFile);
        items.push({
          source: sourceFile,
          target: targetFile,
          source_sha256: sourceHash,
          target_sha256: await fileSha256(targetFile),
          status: "updated"
        });
        continue;
      }

      if (prev) {
        items.push({
          source: sourceFile,
          target: targetFile,
          source_sha256: sourceHash,
          target_sha256: currentTargetHash,
          status: "protected"
        });
        continue;
      }

      items.push({
        source: sourceFile,
        target: targetFile,
        source_sha256: sourceHash,
        target_sha256: currentTargetHash,
        status: "unmanaged"
      });
    }
  }
  return items;
}

async function rollbackFiles(backup: BackupMap): Promise<void> {
  for (const [target, content] of backup.entries()) {
    if (content === null) {
      if (await fileExists(target)) await fs.rm(target, { force: true });
      continue;
    }
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, content);
  }
}

function summarizeParity(items: AssetManifestItem[]): ScaffoldManifest["parity_summary"] {
  const byStatus = (status: AssetManifestItem["status"]) => items.filter((item) => item.status === status).length;
  return {
    match_count: byStatus("match"),
    drift_count: byStatus("drift"),
    missing_count: byStatus("missing"),
    protected_count: byStatus("protected"),
    updated_count: byStatus("updated"),
    unmanaged_count: byStatus("unmanaged")
  };
}

export async function runInit(
  cwd: string,
  options?: { ai?: SupportedAi; lang?: string; preset?: string; script?: "sh" | "ps" }
): Promise<{ installedAgentFiles: string[]; settingsPath: string }> {
  const root = prodoPath(cwd);
  const artifactDefs = await listArtifactDefinitions(cwd);
  const artifactTypes = artifactDefs.map((item) => item.name);
  const workflowCommands = buildWorkflowCommands(artifactTypes);
  const prodoVersion = await readProdoVersion(cwd);
  const localRepoTemplates = path.join(cwd, "templates");
  const packagedTemplates = path.resolve(__dirname, "..", "templates");
  const projectScaffoldTemplates = (await fileExists(localRepoTemplates)) ? localRepoTemplates : packagedTemplates;
  const copiedAssets: Array<{ source: string; target: string; sha256: string }> = [];
  const backup: BackupMap = new Map();
  const previousManifest = await loadPreviousManifest(root);

  await ensureDir(path.join(root, "briefs"));
  await ensureDir(path.join(root, "schemas"));
  await ensureDir(path.join(root, "prompts"));
  await ensureDir(path.join(root, "commands"));
  await ensureDir(path.join(root, "presets"));
  await ensureDir(path.join(root, "templates"));
  await ensureDir(path.join(root, "templates", "overrides"));
  await ensureDir(path.join(root, "state"));
  await ensureDir(path.join(root, "state", "context"));
  for (const def of artifactDefs) {
    await ensureDir(outputDirPath(cwd, def.name, def.output_dir));
  }
  await ensureDir(path.join(cwd, "product-docs", "reports"));
  await writeFileIfMissing(
    outputIndexPath(cwd),
    `${JSON.stringify({ active: {}, history: {}, updated_at: new Date(0).toISOString() }, null, 2)}\n`
  );

  await writeFileIfMissing(briefPath(cwd), START_BRIEF_TEMPLATE);
  await writeFileIfMissing(
    path.join(root, "briefs", "normalized-brief.json"),
    `${JSON.stringify(NORMALIZED_BRIEF_TEMPLATE, null, 2)}\n`
  );
  await writeFileIfMissing(path.join(root, "hooks.yml"), HOOKS_TEMPLATE);
  await writeFileIfMissing(path.join(root, "prompts", "normalize.md"), `${NORMALIZE_PROMPT_TEMPLATE}\n`);
  const scriptType = options?.script ?? (process.platform === "win32" ? "ps" : "sh");
  await fs.writeFile(
    path.join(root, "init-options.json"),
    `${JSON.stringify({ ai: options?.ai ?? null, lang: options?.lang ?? "en", preset: options?.preset ?? null, script: scriptType }, null, 2)}\n`,
    "utf8"
  );

  await copyDirIfMissing(path.join(projectScaffoldTemplates, "artifacts"), path.join(root, "templates"), copiedAssets);
  for (const artifact of artifactDefs) {
    const schema = {
      ...schemaTemplate(artifact.name),
      x_required_headings: artifact.required_headings
    };
    await writeFileIfMissing(path.join(root, "schemas", `${artifact.name}.yaml`), yaml.dump(schema));
    await writeFileIfMissing(path.join(root, "prompts", `${artifact.name}.md`), `${promptTemplate(artifact.name, options?.lang ?? "en")}\n`);
    await writeFileIfMissing(
      path.join(root, "templates", templateFileName(artifact.name)),
      `${artifactTemplateTemplate(artifact.name, options?.lang ?? "en")}\n`
    );
  }

  await copyDirIfMissing(path.join(projectScaffoldTemplates, "commands"), path.join(root, "commands"), copiedAssets);
  await refreshLegacyCommandTemplates(path.join(projectScaffoldTemplates, "commands"), path.join(root, "commands"));
  for (const command of workflowCommands) {
    await writeFileIfMissing(path.join(root, "commands", `${command.name}.md`), `${commandTemplate(command)}\n`);
  }

  await applyConfiguredPresets(cwd, root, prodoVersion, options?.preset);

  const pairs: SourceTargetPair[] = [
    {
      sourceDir: path.join(projectScaffoldTemplates, "commands"),
      targetDir: path.join(root, "commands")
    },
    {
      sourceDir: path.join(projectScaffoldTemplates, "artifacts"),
      targetDir: path.join(root, "templates")
    }
  ];

  let parity: AssetManifestItem[] = [];
  try {
    parity = await buildAssetManifest(pairs, previousManifest, backup);
  } catch (error) {
    await rollbackFiles(backup);
    throw error;
  }

  const installedAgentFiles = options?.ai ? await installAgentCommands(cwd, options.ai) : [];
  const manifest: ScaffoldManifest = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    prodo_version: prodoVersion,
    copied_asset_count: copiedAssets.length,
    copied_assets: copiedAssets,
    asset_count: parity.length,
    parity_summary: summarizeParity(parity),
    assets: parity
  };
  await fs.writeFile(path.join(root, "scaffold-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await syncRegistry(cwd);
  const settingsPath = await writeSettings(cwd, {
    lang: (options?.lang ?? "en").trim() || "en",
    ai: options?.ai
  });
  return { installedAgentFiles, settingsPath };
}

