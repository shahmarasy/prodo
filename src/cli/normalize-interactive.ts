import fs from "node:fs/promises";
import path from "node:path";
import {
  checkConfidence,
  parseNormalizedBriefOrThrow,
  type ConfidenceCheckResult,
  type NormalizedBrief
} from "../core/normalized-brief";
import { runNormalize } from "../core/normalize";
import { normalizedBriefPath, normHistoryPath, prodoPath } from "../core/paths";
import { fileExists, readJsonFile } from "../core/utils";
import { UserError } from "../core/errors";

const CONFIDENCE_FIELDS = [
  "product_name",
  "problem",
  "audience",
  "goals",
  "core_features"
] as const;

const FIELD_QUESTIONS: Record<string, (current: unknown) => string> = {
  product_name: (val) =>
    `The product name was detected as "${val ?? "(empty)"}". Can you confirm or provide the exact product name?`,
  problem: (val) =>
    val
      ? `The problem statement seems unclear: "${String(val).slice(0, 80)}...". Can you describe the core problem more precisely?`
      : "What is the core problem this product solves?",
  audience: (val) =>
    Array.isArray(val) && val.length > 0
      ? `The target audience was detected as: ${(val as string[]).join(", ")}. Is this correct? Add any missing groups.`
      : "Who is the target audience for this product?",
  goals: (val) =>
    Array.isArray(val) && val.length > 0
      ? `The following goals were identified: ${(val as string[]).join("; ")}. Are these correct? Add any missing goals.`
      : "What are the primary goals of this product?",
  core_features: (val) =>
    Array.isArray(val) && val.length > 0
      ? `These core features were detected: ${(val as string[]).join("; ")}. Are these correct? Add any missing features.`
      : "What are the core features of this product?"
};

type NormHistorySession = {
  timestamp: string;
  iteration: number;
  questions: Array<{ field: string; question: string; confidence: number }>;
  answers: Record<string, string>;
};

type NormHistory = {
  version: string;
  sessions: NormHistorySession[];
};

async function loadHistory(cwd: string): Promise<NormHistory> {
  const file = normHistoryPath(cwd);
  if (!(await fileExists(file))) {
    return { version: "1.0", sessions: [] };
  }
  try {
    return await readJsonFile<NormHistory>(file);
  } catch {
    return { version: "1.0", sessions: [] };
  }
}

async function saveHistory(cwd: string, history: NormHistory): Promise<void> {
  const file = normHistoryPath(cwd);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function buildQuestions(
  brief: NormalizedBrief,
  confidenceResult: ConfidenceCheckResult
): Array<{ field: string; question: string; confidence: number }> {
  return confidenceResult.lowFields.map(({ field, confidence }) => {
    const current = brief[field as keyof NormalizedBrief];
    const questionFn = FIELD_QUESTIONS[field];
    const question = questionFn ? questionFn(current) : `Please clarify the "${field}" field.`;
    return { field, question, confidence };
  });
}

export type InteractiveNormalizeOptions = {
  cwd: string;
  brief?: string;
  out?: string;
  maxIterations?: number;
  log?: (message: string) => void;
};

export async function runInteractiveNormalize(
  options: InteractiveNormalizeOptions
): Promise<string> {
  const { cwd, maxIterations = 3, log = console.log } = options;
  const isTTY = process.stdout.isTTY === true;

  if (!isTTY) {
    log("Non-interactive terminal detected. Running standard normalize instead.");
    return runNormalize({ cwd, brief: options.brief, out: options.out });
  }

  const clack = await loadClack();
  if (!clack) {
    log("Interactive prompts not available. Running standard normalize.");
    return runNormalize({ cwd, brief: options.brief, out: options.out });
  }

  const history = await loadHistory(cwd);
  let additionalContext: Record<string, string> = {};
  let iteration = 0;

  clack.intro("Prodo Interactive Normalize");

  while (iteration < maxIterations) {
    iteration += 1;
    log(`\nNormalize iteration ${iteration}/${maxIterations}...`);

    const outPath = await runNormalizeRelaxed({
      cwd,
      brief: options.brief,
      out: options.out,
      additionalContext
    });

    const normalizedRaw = JSON.parse(
      await fs.readFile(outPath, "utf8")
    ) as Record<string, unknown>;
    const brief = parseNormalizedBriefOrThrow(normalizedRaw);

    const result = checkConfidence(brief, [...CONFIDENCE_FIELDS], 0.7);

    if (result.pass) {
      log("All fields have sufficient confidence.");
      clack.outro("Normalization complete!");
      await saveHistory(cwd, history);
      return outPath;
    }

    const questions = buildQuestions(brief, result);
    log(`\n${questions.length} field(s) need clarification:\n`);

    const session: NormHistorySession = {
      timestamp: new Date().toISOString(),
      iteration,
      questions,
      answers: {}
    };

    for (const q of questions) {
      const answer = await clack.text({
        message: `[${(q.confidence * 100).toFixed(0)}% confidence] ${q.question}`,
        placeholder: "Type your answer or press Enter to skip..."
      });

      if (clack.isCancel(answer)) {
        clack.cancel("Normalize cancelled.");
        await saveHistory(cwd, history);
        return outPath;
      }

      const answerStr = typeof answer === "string" ? answer.trim() : "";
      if (answerStr.length > 0) {
        additionalContext[q.field] = answerStr;
        session.answers[q.field] = answerStr;
      }
    }

    history.sessions.push(session);

    if (Object.keys(session.answers).length === 0) {
      log("No clarifications provided. Keeping current normalization.");
      clack.outro("Normalization complete (as-is).");
      await saveHistory(cwd, history);
      return outPath;
    }

    const shouldContinue = await clack.confirm({
      message: "Continue refining? (No = accept current result)"
    });

    if (clack.isCancel(shouldContinue) || shouldContinue === false) {
      clack.outro("Normalization accepted.");
      await saveHistory(cwd, history);
      return outPath;
    }
  }

  log(`Maximum iterations (${maxIterations}) reached.`);
  clack.outro("Normalization complete.");
  await saveHistory(cwd, history);

  const finalPath = options.out
    ? path.resolve(cwd, options.out)
    : normalizedBriefPath(cwd);
  return finalPath;
}

async function runNormalizeRelaxed(options: {
  cwd: string;
  brief?: string;
  out?: string;
  additionalContext?: Record<string, string>;
}): Promise<string> {
  try {
    return await runNormalize(options);
  } catch (error) {
    if (
      error instanceof UserError &&
      error.message.includes("Normalization confidence too low")
    ) {
      const outPath = options.out
        ? path.resolve(options.cwd, options.out)
        : normalizedBriefPath(options.cwd);
      if (await fileExists(outPath)) return outPath;
    }
    throw error;
  }
}

type ClackModule = {
  intro: (title: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
  text: (opts: { message: string; placeholder?: string }) => Promise<string | symbol>;
  confirm: (opts: { message: string }) => Promise<boolean | symbol>;
  isCancel: (value: unknown) => boolean;
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

async function loadClack(): Promise<ClackModule | null> {
  try {
    return (await dynamicImport("@clack/prompts")) as ClackModule;
  } catch {
    return null;
  }
}
