import fs from "node:fs/promises";
import { settingsPath } from "./paths";
import { fileExists } from "./utils";

export type ProdoSettings = {
  lang: string;
  ai?: string;
  author?: string;
};

const DEFAULT_SETTINGS: ProdoSettings = {
  lang: "en"
};

export async function readSettings(cwd: string): Promise<ProdoSettings> {
  const path = settingsPath(cwd);
  if (!(await fileExists(path))) return { ...DEFAULT_SETTINGS };
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProdoSettings>;
    return {
      lang: typeof parsed.lang === "string" && parsed.lang.trim() ? parsed.lang.trim() : "en",
      ai: typeof parsed.ai === "string" && parsed.ai.trim() ? parsed.ai.trim() : undefined,
      author: typeof parsed.author === "string" && parsed.author.trim() ? parsed.author.trim() : undefined
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(cwd: string, settings: ProdoSettings): Promise<string> {
  const path = settingsPath(cwd);
  await fs.writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return path;
}
