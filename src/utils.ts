import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function listFilesSortedByMtime(dirPath: string): Promise<string[]> {
  const exists = await fileExists(dirPath);
  if (!exists) return [];

  const entries = await fs.readdir(dirPath);
  const withStats = await Promise.all(
    entries.map(async (name) => {
      const fullPath = path.join(dirPath, name);
      const stat = await fs.stat(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
    })
  );

  return withStats
    .filter((entry) => entry.isFile)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((entry) => entry.fullPath);
}

export function isPathInside(parentDir: string, candidatePath: string): boolean {
  const parent = path.resolve(parentDir);
  const child = path.resolve(candidatePath);
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
