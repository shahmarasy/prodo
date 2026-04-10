import fs from "node:fs/promises";
import path from "node:path";
import { prodoPath } from "../core/paths";
import { fileExists } from "../core/utils";
import type { Skill, SkillManifest } from "./types";

function isValidManifest(obj: unknown): obj is SkillManifest {
  if (!obj || typeof obj !== "object") return false;
  const m = obj as Record<string, unknown>;
  return (
    typeof m.name === "string" &&
    typeof m.version === "string" &&
    typeof m.description === "string" &&
    Array.isArray(m.depends_on) &&
    Array.isArray(m.inputs) &&
    Array.isArray(m.outputs)
  );
}

export async function discoverSkills(
  cwd: string,
  log?: (message: string) => void
): Promise<Skill[]> {
  const skillsDir = path.join(prodoPath(cwd), "skills");
  if (!(await fileExists(skillsDir))) return [];

  const entries = await fs.readdir(skillsDir);
  const jsFiles = entries.filter((e) => e.endsWith(".js"));
  const skills: Skill[] = [];

  for (const file of jsFiles) {
    const fullPath = path.resolve(skillsDir, file);
    try {
      const mod = require(fullPath) as Record<string, unknown>;
      const manifest = mod.manifest;
      const execute = mod.execute;

      if (!isValidManifest(manifest)) {
        log?.(`[Skill Discovery] Skipping ${file}: invalid or missing manifest`);
        continue;
      }

      if (typeof execute !== "function") {
        log?.(`[Skill Discovery] Skipping ${file}: missing execute function`);
        continue;
      }

      skills.push({ manifest, execute: execute as Skill["execute"] });
      log?.(`[Skill Discovery] Loaded plugin: ${manifest.name} v${manifest.version}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.(`[Skill Discovery] Failed to load ${file}: ${message}`);
    }
  }

  return skills;
}
