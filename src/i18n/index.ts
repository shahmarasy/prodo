import fs from "node:fs";
import path from "node:path";

type TranslationMap = Record<string, string>;

const cache = new Map<string, TranslationMap>();

function loadJson(lang: string): TranslationMap {
  if (cache.has(lang)) return cache.get(lang)!;
  const filePath = path.resolve(__dirname, `${lang}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as TranslationMap;
    cache.set(lang, parsed);
    return parsed;
  } catch {
    cache.set(lang, {});
    return {};
  }
}

function normalizeLang(lang?: string): string {
  if (!lang) return "en";
  const code = lang.toLowerCase().trim();
  if (code.startsWith("tr")) return "tr";
  if (code.startsWith("en")) return "en";
  return code;
}

export function t(key: string, lang?: string): string {
  const normalized = normalizeLang(lang);
  const translations = loadJson(normalized);

  if (key in translations) return translations[key];

  if (normalized !== "en") {
    const fallback = loadJson("en");
    if (key in fallback) return fallback[key];
  }

  return key;
}

export function loadTranslations(lang: string): TranslationMap {
  return { ...loadJson(normalizeLang(lang)) };
}

export function availableLanguages(): string[] {
  const dir = path.resolve(__dirname);
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort();
  } catch {
    return ["en"];
  }
}
