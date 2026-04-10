import fs from "node:fs/promises";
import path from "node:path";
import { listArtifactDefinitions, listArtifactTypes } from "./artifact-registry";
import { generateArtifact } from "./artifacts";
import { UserError } from "./errors";
import { runHookPhase } from "./hook-executor";
import { runNormalize } from "./normalize";
import { getActiveArtifactPath } from "./output-index";
import { prodoPath } from "./paths";
import type { ArtifactType, ValidationIssue } from "./types";
import { ensureDir, fileExists, timestampSlug } from "./utils";
import { runValidate, type ValidateResult } from "./validate";

export type FixProposal = {
  targets: ArtifactType[];
  issues: ValidationIssue[];
  issuesByArtifact: Map<ArtifactType, ValidationIssue[]>;
  initialReport: ValidateResult;
};

export type FixOptions = {
  cwd: string;
  agent?: string;
  strict?: boolean;
  report?: string;
  dryRun?: boolean;
  log?: (message: string) => void;
};

export type FixResult = {
  proposal: FixProposal;
  applied: boolean;
  finalPass: boolean;
  reportPath: string;
  backupDir?: string;
};

export async function resolveFixTargets(
  cwd: string,
  artifactTypes: ArtifactType[],
  issues: Array<{ artifactType?: ArtifactType }>
): Promise<ArtifactType[]> {
  const direct = new Set<ArtifactType>(
    issues
      .map((issue) => issue.artifactType)
      .filter(
        (artifactType): artifactType is ArtifactType =>
          typeof artifactType === "string" && artifactTypes.includes(artifactType)
      )
  );
  if (direct.size === 0) return artifactTypes;

  const defs = await listArtifactDefinitions(cwd);
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of defs) {
      const needsRefresh = def.upstream.some((upstream) => direct.has(upstream));
      if (needsRefresh && !direct.has(def.name)) {
        direct.add(def.name);
        changed = true;
      }
    }
  }

  return artifactTypes.filter((artifactType) => direct.has(artifactType));
}

export async function buildFixProposal(options: FixOptions): Promise<FixProposal> {
  const { cwd, strict, report } = options;

  const initialReport = await runValidate(cwd, {
    strict: Boolean(strict),
    report
  });

  if (initialReport.pass) {
    return {
      targets: [],
      issues: [],
      issuesByArtifact: new Map(),
      initialReport
    };
  }

  const artifactTypes = await listArtifactTypes(cwd);
  const targets = await resolveFixTargets(cwd, artifactTypes, initialReport.issues);

  const issuesByArtifact = new Map<ArtifactType, ValidationIssue[]>();
  for (const issue of initialReport.issues) {
    if (issue.artifactType) {
      const existing = issuesByArtifact.get(issue.artifactType) ?? [];
      existing.push(issue);
      issuesByArtifact.set(issue.artifactType, existing);
    }
  }

  return {
    targets,
    issues: initialReport.issues,
    issuesByArtifact,
    initialReport
  };
}

function backupBasePath(cwd: string): string {
  return path.join(prodoPath(cwd), "state", "backups");
}

export async function createBackup(
  cwd: string,
  targets: ArtifactType[]
): Promise<string> {
  const slug = timestampSlug();
  const backupDir = path.join(backupBasePath(cwd), slug);
  await ensureDir(backupDir);

  const manifest: Array<{ type: ArtifactType; source: string; dest: string }> = [];

  for (const type of targets) {
    const activePath = await getActiveArtifactPath(cwd, type);
    if (!activePath || !(await fileExists(activePath))) continue;

    const relPath = path.relative(cwd, activePath);
    const destPath = path.join(backupDir, relPath);
    await ensureDir(path.dirname(destPath));
    await fs.copyFile(activePath, destPath);
    manifest.push({ type, source: activePath, dest: destPath });

    const parsed = path.parse(activePath);
    const sidecar = path.join(parsed.dir, `${parsed.name}.artifact.json`);
    if (await fileExists(sidecar)) {
      const sidecarRel = path.relative(cwd, sidecar);
      const sidecarDest = path.join(backupDir, sidecarRel);
      await fs.copyFile(sidecar, sidecarDest);
    }

    const companionExtensions = type === "workflow" ? [".mmd"] : type === "wireframe" ? [".html"] : [];
    for (const ext of companionExtensions) {
      const companionPath = path.join(parsed.dir, `${parsed.name}${ext}`);
      if (await fileExists(companionPath)) {
        const companionRel = path.relative(cwd, companionPath);
        const companionDest = path.join(backupDir, companionRel);
        await ensureDir(path.dirname(companionDest));
        await fs.copyFile(companionPath, companionDest);
      }
    }
  }

  await fs.writeFile(
    path.join(backupDir, "_manifest.json"),
    `${JSON.stringify({ timestamp: slug, targets, files: manifest }, null, 2)}\n`,
    "utf8"
  );

  return backupDir;
}

export async function restoreBackup(cwd: string, backupDir: string): Promise<void> {
  const manifestPath = path.join(backupDir, "_manifest.json");
  if (!(await fileExists(manifestPath))) {
    throw new UserError("Backup manifest not found. Cannot restore.");
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    files: Array<{ source: string; dest: string }>;
  };

  for (const entry of manifest.files) {
    if (await fileExists(entry.dest)) {
      await ensureDir(path.dirname(entry.source));
      await fs.copyFile(entry.dest, entry.source);
    }
  }
}

export async function applyFix(
  cwd: string,
  proposal: FixProposal,
  options: FixOptions
): Promise<FixResult> {
  const { agent, strict, report, log = console.log } = options;
  const backupDir = await createBackup(cwd, proposal.targets);

  await runHookPhase(cwd, "before_normalize", log);
  const normalizedPath = await runNormalize({ cwd });
  log(`Normalized brief refreshed: ${normalizedPath}`);
  await runHookPhase(cwd, "after_normalize", log);

  for (const type of proposal.targets) {
    await runHookPhase(cwd, `before_${type}`, log);
    const agentResolved = agent ?? undefined;
    const file = await generateArtifact({
      artifactType: type,
      cwd,
      normalizedBriefOverride: normalizedPath,
      agent: agentResolved,
      revisionType: "fix"
    });
    log(`${type.toUpperCase()} regenerated (fix): ${file}`);
    await runHookPhase(cwd, `after_${type}`, log);
  }

  await runHookPhase(cwd, "before_validate", log);
  const finalResult = await runValidate(cwd, {
    strict: Boolean(strict),
    report
  });
  await runHookPhase(cwd, "after_validate", log);

  return {
    proposal,
    applied: true,
    finalPass: finalResult.pass,
    reportPath: finalResult.reportPath,
    backupDir
  };
}

export async function runFix(options: FixOptions): Promise<FixResult> {
  const { cwd, dryRun, log = console.log } = options;

  const proposal = await buildFixProposal(options);

  if (proposal.targets.length === 0) {
    log("No blocking issues found. Nothing to fix.");
    return {
      proposal,
      applied: false,
      finalPass: true,
      reportPath: proposal.initialReport.reportPath
    };
  }

  if (dryRun) {
    log(`[Dry Run] Would regenerate: ${proposal.targets.join(", ")}`);
    log(`[Dry Run] ${proposal.issues.length} issue(s) identified.`);
    for (const [type, issues] of proposal.issuesByArtifact) {
      log(`  ${type}: ${issues.length} issue(s)`);
      for (const issue of issues) {
        log(`    - [${issue.level}] ${issue.code}: ${issue.message}`);
      }
    }
    return {
      proposal,
      applied: false,
      finalPass: false,
      reportPath: proposal.initialReport.reportPath
    };
  }

  return applyFix(cwd, proposal, options);
}
