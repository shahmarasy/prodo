import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { registryPath } from "./paths";
import { ensureDir, fileExists } from "./utils";

export type OverrideRegistryEntry = {
  artifact_type: string;
  file: string;
  sha256: string;
};

export type ProdoRegistry = {
  schema_version: "1.0";
  updated_at: string;
  installed_presets: string[];
  installed_overrides: OverrideRegistryEntry[];
};

const EMPTY_REGISTRY: ProdoRegistry = {
  schema_version: "1.0",
  updated_at: new Date(0).toISOString(),
  installed_presets: [],
  installed_overrides: []
};

async function sha256(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath);
  return createHash("sha256").update(raw).digest("hex");
}

function sanitizeRegistry(input: unknown): ProdoRegistry {
  if (!input || typeof input !== "object") return { ...EMPTY_REGISTRY };
  const raw = input as Record<string, unknown>;
  const installedPresets = Array.isArray(raw.installed_presets)
    ? raw.installed_presets
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    : [];
  const installedOverrides = Array.isArray(raw.installed_overrides)
    ? raw.installed_overrides
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        artifact_type: typeof item.artifact_type === "string" ? item.artifact_type.trim() : "",
        file: typeof item.file === "string" ? item.file.trim() : "",
        sha256: typeof item.sha256 === "string" ? item.sha256.trim() : ""
      }))
      .filter((item) => item.artifact_type && item.file && item.sha256)
    : [];
  return {
    schema_version: "1.0",
    updated_at: typeof raw.updated_at === "string" && raw.updated_at.trim() ? raw.updated_at : EMPTY_REGISTRY.updated_at,
    installed_presets: Array.from(new Set(installedPresets)),
    installed_overrides: installedOverrides
  };
}

export async function readRegistry(cwd: string): Promise<ProdoRegistry> {
  const file = registryPath(cwd);
  if (!(await fileExists(file))) return { ...EMPTY_REGISTRY };
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    return sanitizeRegistry(parsed);
  } catch {
    return { ...EMPTY_REGISTRY };
  }
}

async function readInstalledPresetsFromFile(cwd: string): Promise<string[]> {
  const file = path.join(cwd, ".prodo", "presets", "installed.json");
  if (!(await fileExists(file))) return [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

async function discoverOverrides(cwd: string): Promise<OverrideRegistryEntry[]> {
  const overridesDir = path.join(cwd, ".prodo", "templates", "overrides");
  if (!(await fileExists(overridesDir))) return [];
  const entries = await fs.readdir(overridesDir, { withFileTypes: true });
  const out: OverrideRegistryEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) continue;
    const fullPath = path.join(overridesDir, entry.name);
    out.push({
      artifact_type: entry.name.replace(/\.md$/, ""),
      file: fullPath,
      sha256: await sha256(fullPath)
    });
  }
  out.sort((a, b) => a.artifact_type.localeCompare(b.artifact_type));
  return out;
}

export async function syncRegistry(cwd: string): Promise<ProdoRegistry> {
  const existing = await readRegistry(cwd);
  const discoveredPresets = await readInstalledPresetsFromFile(cwd);
  const discoveredOverrides = await discoverOverrides(cwd);
  const mergedPresets = Array.from(new Set([...existing.installed_presets, ...discoveredPresets])).sort();
  const merged: ProdoRegistry = {
    schema_version: "1.0",
    updated_at: new Date().toISOString(),
    installed_presets: mergedPresets,
    installed_overrides: discoveredOverrides
  };
  const file = registryPath(cwd);
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}
