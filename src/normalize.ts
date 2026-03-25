import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./errors";
import {
  buildContractsFromArrays,
  parseNormalizedBriefOrThrow,
  requireConfidenceOrThrow
} from "./normalized-brief";
import { briefPath, normalizedBriefPath, prodoPath } from "./paths";
import { createProvider } from "./providers";
import { readSettings } from "./settings";
import { fileExists, isPathInside } from "./utils";

type NormalizeOptions = {
  cwd: string;
  brief?: string;
  out?: string;
};

function normalizedKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractBriefProductName(rawBrief: string): string | undefined {
  const lines = rawBrief.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^\s*#{1,6}\s+(.+?)\s*$/);
    if (!headingMatch) continue;
    const headingKey = normalizedKey(headingMatch[1]);
    const isProductHeading =
      headingKey === "product name" ||
      headingKey === "project name" ||
      headingKey === "urun adi" ||
      headingKey === "urun ismi";
    if (!isProductHeading) continue;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const rawLine = lines[cursor].trim();
      if (!rawLine) continue;
      if (/^\s*#{1,6}\s+/.test(rawLine)) break;
      const cleaned = rawLine.replace(/^\s*[-*]\s*/, "").trim();
      if (cleaned.length > 0) return cleaned;
    }
  }
  return undefined;
}

function preserveOriginalProductName(
  parsed: Record<string, unknown>,
  rawBrief: string
): Record<string, unknown> {
  const briefProductName = extractBriefProductName(rawBrief);
  if (!briefProductName) return parsed;
  const generated = typeof parsed.product_name === "string" ? parsed.product_name : "";
  if (!generated.trim()) return { ...parsed, product_name: briefProductName };
  if (normalizedKey(generated) !== normalizedKey(briefProductName)) return parsed;
  return { ...parsed, product_name: briefProductName };
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new UserError("Normalizer provider did not return valid JSON.");
  }
}

export async function runNormalize(options: NormalizeOptions): Promise<string> {
  const { cwd } = options;
  const root = prodoPath(cwd);
  if (!(await fileExists(root))) {
    throw new UserError("Missing .prodo directory. Run `prodo init .` first.");
  }

  const inPath = options.brief ? path.resolve(cwd, options.brief) : briefPath(cwd);
  if (!(await fileExists(inPath))) {
    throw new UserError(`Brief file not found: ${inPath}`);
  }

  const rawBrief = await fs.readFile(inPath, "utf8");
  const normalizePromptPath = path.join(root, "prompts", "normalize.md");
  const normalizePrompt = await fs.readFile(normalizePromptPath, "utf8");
  const settings = await readSettings(cwd);
  const provider = createProvider();

  const generated = await provider.generate(
    normalizePrompt,
    {
      briefMarkdown: rawBrief,
      sourceBriefPath: inPath,
      outputLanguage: settings.lang
    },
    {
      artifactType: "normalize",
      requiredHeadings: [],
      requiredContracts: []
    }
  );

  const parsed = extractJsonObject(generated.body);
  const preserved = preserveOriginalProductName(parsed, rawBrief);
  const withContracts = {
    ...preserved,
    contracts:
      preserved.contracts ??
      buildContractsFromArrays({
        goals: Array.isArray(preserved.goals) ? preserved.goals.filter((x): x is string => typeof x === "string") : [],
        core_features: Array.isArray(preserved.core_features)
          ? preserved.core_features.filter((x): x is string => typeof x === "string")
          : [],
        constraints: Array.isArray(preserved.constraints)
          ? preserved.constraints.filter((x): x is string => typeof x === "string")
          : []
      })
  };

  const normalized = parseNormalizedBriefOrThrow(withContracts);
  requireConfidenceOrThrow(normalized, ["product_name", "problem", "audience", "goals", "core_features"], 0.7);

  const outPath = options.out ? path.resolve(cwd, options.out) : normalizedBriefPath(cwd);
  if (!isPathInside(prodoPath(cwd), outPath)) {
    throw new UserError("Normalize output must be inside `.prodo/`.");
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return outPath;
}
