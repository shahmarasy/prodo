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
  const withContracts = {
    ...parsed,
    contracts:
      parsed.contracts ??
      buildContractsFromArrays({
        goals: Array.isArray(parsed.goals) ? parsed.goals.filter((x): x is string => typeof x === "string") : [],
        core_features: Array.isArray(parsed.core_features)
          ? parsed.core_features.filter((x): x is string => typeof x === "string")
          : [],
        constraints: Array.isArray(parsed.constraints)
          ? parsed.constraints.filter((x): x is string => typeof x === "string")
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
