import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./utils";

export async function readCliVersion(cwd: string): Promise<string> {
  const candidates = [
    path.join(cwd, "package.json"),
    path.resolve(__dirname, "..", "package.json")
  ];
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) continue;
    try {
      const raw = await fs.readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as { version?: unknown };
      if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
        return parsed.version.trim();
      }
    } catch {
      // ignore and continue
    }
  }
  return "0.0.0";
}

