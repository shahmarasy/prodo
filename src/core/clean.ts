import fs from "node:fs/promises";
import path from "node:path";
import { prodoPath } from "./paths";
import { fileExists } from "./utils";

export type CleanOptions = {
  cwd: string;
  dryRun?: boolean;
  log?: (message: string) => void;
};

export type CleanResult = {
  removedPaths: string[];
  preservedPaths: string[];
};

const REMOVABLE_DIRS = [
  "product-docs"
];

const REMOVABLE_PRODO_SUBDIRS = [
  "state",
  "briefs"
];

const PRESERVED_PRODO_FILES = [
  "settings.json",
  "hooks.yml",
  "config.json"
];

export async function runClean(options: CleanOptions): Promise<CleanResult> {
  const { cwd, dryRun = false, log = console.log } = options;
  const result: CleanResult = { removedPaths: [], preservedPaths: [] };

  for (const dir of REMOVABLE_DIRS) {
    const fullPath = path.join(cwd, dir);
    if (await fileExists(fullPath)) {
      if (dryRun) {
        log(`[Dry Run] Would remove: ${fullPath}`);
      } else {
        await fs.rm(fullPath, { recursive: true, force: true });
        log(`Removed: ${fullPath}`);
      }
      result.removedPaths.push(fullPath);
    }
  }

  const prodo = prodoPath(cwd);
  for (const subdir of REMOVABLE_PRODO_SUBDIRS) {
    const fullPath = path.join(prodo, subdir);
    if (await fileExists(fullPath)) {
      if (dryRun) {
        log(`[Dry Run] Would remove: ${fullPath}`);
      } else {
        await fs.rm(fullPath, { recursive: true, force: true });
        log(`Removed: ${fullPath}`);
      }
      result.removedPaths.push(fullPath);
    }
  }

  const briefPath = path.join(cwd, "brief.md");
  if (await fileExists(briefPath)) {
    result.preservedPaths.push(briefPath);
  }

  for (const file of PRESERVED_PRODO_FILES) {
    const fullPath = path.join(prodo, file);
    if (await fileExists(fullPath)) {
      result.preservedPaths.push(fullPath);
    }
  }

  const preservedDirs = ["templates", "schemas", "prompts", "commands", "presets"];
  for (const dir of preservedDirs) {
    const fullPath = path.join(prodo, dir);
    if (await fileExists(fullPath)) {
      result.preservedPaths.push(fullPath);
    }
  }

  if (result.preservedPaths.length > 0 && !dryRun) {
    log(`Preserved: ${result.preservedPaths.length} file(s)/dir(s)`);
  }

  return result;
}
