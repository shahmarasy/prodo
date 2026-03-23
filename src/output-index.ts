import fs from "node:fs/promises";
import path from "node:path";
import { outputIndexPath } from "./paths";
import type { ArtifactType } from "./types";
import { ensureDir, fileExists } from "./utils";

type ArtifactMap = Partial<Record<ArtifactType, string>>;
type ArtifactHistoryMap = Partial<Record<ArtifactType, string[]>>;

export type OutputIndex = {
  active: ArtifactMap;
  history: ArtifactHistoryMap;
  updated_at: string;
};

function defaultIndex(): OutputIndex {
  return {
    active: {},
    history: {},
    updated_at: new Date(0).toISOString()
  };
}

export async function loadOutputIndex(cwd: string): Promise<OutputIndex> {
  const indexPath = outputIndexPath(cwd);
  if (!(await fileExists(indexPath))) return defaultIndex();
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<OutputIndex>;
  return {
    active: parsed.active ?? {},
    history: parsed.history ?? {},
    updated_at: parsed.updated_at ?? new Date(0).toISOString()
  };
}

export async function saveOutputIndex(cwd: string, index: OutputIndex): Promise<void> {
  const indexPath = outputIndexPath(cwd);
  await ensureDir(path.dirname(indexPath));
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function setActiveArtifact(cwd: string, type: ArtifactType, filePath: string): Promise<void> {
  const index = await loadOutputIndex(cwd);
  const normalizedPath = path.resolve(filePath);
  const existing = index.history[type] ?? [];
  index.active[type] = normalizedPath;
  index.history[type] = [normalizedPath, ...existing.filter((item) => item !== normalizedPath)].slice(0, 100);
  index.updated_at = new Date().toISOString();
  await saveOutputIndex(cwd, index);
}

export async function getActiveArtifactPath(cwd: string, type: ArtifactType): Promise<string | undefined> {
  const index = await loadOutputIndex(cwd);
  const candidate = index.active[type];
  if (!candidate) return undefined;
  if (await fileExists(candidate)) return candidate;
  return undefined;
}

