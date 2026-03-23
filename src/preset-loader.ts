import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { UserError } from "./errors";
import { readProjectConfig } from "./project-config";
import { ensureDir, fileExists } from "./utils";

type PresetManifest = {
  name: string;
  version?: string;
  priority?: number;
  min_prodo_version?: string;
  max_prodo_version?: string;
  command_packs?: string[];
};

type CopyOp = {
  source: string;
  target: string;
  priority: number;
  order: number;
};

function parseVersion(version: string): number[] {
  return version.split(".").map((part) => Number(part.replace(/[^0-9]/g, "")) || 0).slice(0, 3);
}

function cmpVersion(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((left[i] ?? 0) > (right[i] ?? 0)) return 1;
    if ((left[i] ?? 0) < (right[i] ?? 0)) return -1;
  }
  return 0;
}

async function readPresetManifest(presetDir: string): Promise<PresetManifest> {
  const candidates = ["preset.yaml", "preset.yml", "preset.json"];
  for (const name of candidates) {
    const file = path.join(presetDir, name);
    if (!(await fileExists(file))) continue;
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
      const presetName = typeof parsed.name === "string" ? parsed.name.trim() : path.basename(presetDir);
      return {
        name: presetName,
        version: typeof parsed.version === "string" ? parsed.version : undefined,
        priority: typeof parsed.priority === "number" ? parsed.priority : 0,
        min_prodo_version: typeof parsed.min_prodo_version === "string" ? parsed.min_prodo_version : undefined,
        max_prodo_version: typeof parsed.max_prodo_version === "string" ? parsed.max_prodo_version : undefined,
        command_packs: Array.isArray(parsed.command_packs)
          ? parsed.command_packs.filter((item): item is string => typeof item === "string")
          : []
      };
    }
    const parsed = (yaml.load(await fs.readFile(file, "utf8")) as Record<string, unknown>) ?? {};
    const presetName = typeof parsed.name === "string" ? parsed.name.trim() : path.basename(presetDir);
    return {
      name: presetName,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
      priority: typeof parsed.priority === "number" ? parsed.priority : 0,
      min_prodo_version: typeof parsed.min_prodo_version === "string" ? parsed.min_prodo_version : undefined,
      max_prodo_version: typeof parsed.max_prodo_version === "string" ? parsed.max_prodo_version : undefined,
      command_packs: Array.isArray(parsed.command_packs)
        ? parsed.command_packs.filter((item): item is string => typeof item === "string")
        : []
    };
  }
  throw new UserError(`Preset manifest is missing in ${presetDir} (expected preset.yaml or preset.json).`);
}

async function collectFilesRecursive(rootDir: string): Promise<string[]> {
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

async function collectPresetOps(
  presetDir: string,
  prodoRoot: string,
  priority: number,
  order: number
): Promise<CopyOp[]> {
  const lanes = ["prompts", "schemas", "templates", "commands"];
  const ops: CopyOp[] = [];
  for (const lane of lanes) {
    const sourceBase = path.join(presetDir, lane);
    const files = await collectFilesRecursive(sourceBase);
    for (const source of files) {
      const relative = path.relative(sourceBase, source);
      ops.push({
        source,
        target: path.join(prodoRoot, lane, relative),
        priority,
        order
      });
    }
  }
  return ops;
}

async function resolvePresetDir(projectRoot: string, presetName: string): Promise<string> {
  const candidates = [
    path.join(projectRoot, "presets", presetName),
    path.resolve(__dirname, "..", "presets", presetName)
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new UserError(`Preset not found: ${presetName}. Create presets/${presetName} with a preset manifest.`);
}

async function writeInstalledPresets(prodoRoot: string, names: string[]): Promise<void> {
  const file = path.join(prodoRoot, "presets", "installed.json");
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(Array.from(new Set(names)).sort(), null, 2)}\n`, "utf8");
}

async function readInstalledPresets(prodoRoot: string): Promise<string[]> {
  const file = path.join(prodoRoot, "presets", "installed.json");
  if (!(await fileExists(file))) return [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

async function applyCopyOps(ops: CopyOp[]): Promise<void> {
  const selected = new Map<string, CopyOp>();
  for (const op of ops) {
    const current = selected.get(op.target);
    if (!current) {
      selected.set(op.target, op);
      continue;
    }
    if (op.priority > current.priority || (op.priority === current.priority && op.order > current.order)) {
      selected.set(op.target, op);
    }
  }
  for (const op of selected.values()) {
    await ensureDir(path.dirname(op.target));
    await fs.copyFile(op.source, op.target);
  }
}

async function collectCommandPackOps(projectRoot: string, prodoRoot: string, names: string[]): Promise<CopyOp[]> {
  const ops: CopyOp[] = [];
  for (const [index, name] of names.entries()) {
    const base = path.join(projectRoot, "command-packs", name);
    if (!(await fileExists(base))) {
      throw new UserError(`Command pack not found: command-packs/${name}`);
    }
    const laneMap: Record<string, string> = {
      commands: "commands"
    };
    for (const [sourceLane, targetLane] of Object.entries(laneMap)) {
      const sourceBase = path.join(base, sourceLane);
      const files = await collectFilesRecursive(sourceBase);
      for (const source of files) {
        const relative = path.relative(sourceBase, source);
        ops.push({
          source,
          target: path.join(prodoRoot, targetLane, relative),
          priority: 100,
          order: index
        });
      }
    }
  }
  return ops;
}

export async function applyConfiguredPresets(
  projectRoot: string,
  prodoRoot: string,
  prodoVersion: string,
  presetOverride?: string
): Promise<{ installedPresets: string[]; appliedFiles: string[] }> {
  const config = await readProjectConfig(projectRoot);
  const presets = Array.from(new Set([...(config.presets ?? []), ...(presetOverride ? [presetOverride] : [])]));
  const existingInstalled = await readInstalledPresets(prodoRoot);
  const allOps: CopyOp[] = [];
  const installedNames: string[] = [...existingInstalled];
  const commandPacks = new Set<string>(config.command_packs ?? []);

  for (const [order, presetName] of presets.entries()) {
    const presetDir = await resolvePresetDir(projectRoot, presetName);
    const manifest = await readPresetManifest(presetDir);
    if (manifest.min_prodo_version && cmpVersion(prodoVersion, manifest.min_prodo_version) < 0) {
      throw new UserError(
        `Preset ${presetName} requires prodo >= ${manifest.min_prodo_version}, current is ${prodoVersion}.`
      );
    }
    if (manifest.max_prodo_version && cmpVersion(prodoVersion, manifest.max_prodo_version) > 0) {
      throw new UserError(
        `Preset ${presetName} supports prodo <= ${manifest.max_prodo_version}, current is ${prodoVersion}.`
      );
    }
    for (const pack of manifest.command_packs ?? []) {
      if (pack.trim()) commandPacks.add(pack.trim());
    }
    installedNames.push(manifest.name || presetName);
    allOps.push(...(await collectPresetOps(presetDir, prodoRoot, manifest.priority ?? 0, order)));
  }

  const commandPackList = Array.from(commandPacks);
  if (commandPackList.length > 0) {
    const commandPackOps = await collectCommandPackOps(projectRoot, prodoRoot, commandPackList);
    allOps.push(...commandPackOps);
  }
  if (allOps.length > 0) await applyCopyOps(allOps);
  await writeInstalledPresets(prodoRoot, installedNames);

  return {
    installedPresets: Array.from(new Set(installedNames)),
    appliedFiles: Array.from(new Set(allOps.map((item) => item.target)))
  };
}
