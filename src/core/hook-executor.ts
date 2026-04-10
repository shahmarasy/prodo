import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import yaml from "js-yaml";
import { UserError } from "./errors";
import { fileExists } from "./utils";

type HookItem = {
  command?: string;
  optional?: boolean;
  enabled?: boolean;
  description?: string;
  prompt?: string;
  extension?: string;
  condition?: string;
  timeout_ms?: number;
  retry?: number;
  retry_delay_ms?: number;
};

type HooksConfig = {
  hooks?: Record<string, HookItem[]>;
};

function hooksPath(cwd: string): string {
  return path.join(cwd, ".prodo", "hooks.yml");
}

async function runShellCommand(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }> {
  const parsed = parseCommand(command);
  if (!parsed) {
    return { code: 1, stdout: "", stderr: "Invalid hook command syntax.", timedOut: false };
  }
  return new Promise((resolve) => {
    const child = spawn(parsed.bin, parsed.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Math.max(1000, timeoutMs));

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

function parseCommand(command: string): { bin: string; args: string[] } | null {
  const src = command.trim();
  if (!src) return null;
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        out.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (escaping || quote) return null;
  if (current.length > 0) out.push(current);
  if (out.length === 0) return null;
  return { bin: out[0], args: out.slice(1) };
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluateCondition(condition: string, cwd: string): Promise<boolean> {
  const trimmed = condition.trim();
  if (!trimmed) return true;
  const result = await runShellCommand(trimmed, cwd, 10_000);
  return !result.timedOut && result.code === 0;
}

async function readHooks(cwd: string): Promise<HooksConfig | null> {
  const file = hooksPath(cwd);
  if (!(await fileExists(file))) return null;
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = yaml.load(raw) as HooksConfig;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export async function runHookPhase(
  cwd: string,
  phaseKey: string,
  log: (message: string) => void
): Promise<void> {
  const config = await readHooks(cwd);
  const phaseHooks = config?.hooks?.[phaseKey];
  if (!Array.isArray(phaseHooks) || phaseHooks.length === 0) return;

  for (const hook of phaseHooks) {
    if (hook?.enabled === false) continue;
    const command = typeof hook?.command === "string" ? hook.command.trim() : "";
    if (!command) continue;
    if (typeof hook.condition === "string" && hook.condition.trim()) {
      const pass = await evaluateCondition(hook.condition, cwd);
      if (!pass) {
        log(`[Hook:skipped:${phaseKey}] condition=false for ${command}`);
        continue;
      }
    }

    const label = hook.extension || hook.description || command;
    if (hook.optional) {
      log(`[Hook:optional:${phaseKey}] ${label}`);
      if (hook.prompt) log(`  Prompt: ${hook.prompt}`);
      log(`  To run manually: ${command}`);
      continue;
    }

    const timeoutMs = toPositiveInt(hook.timeout_ms, 30_000);
    const retries = toNonNegativeInt(hook.retry, 0);
    const retryDelayMs = toNonNegativeInt(hook.retry_delay_ms, 500);
    const attempts = 1 + retries;

    let lastDetail = "";
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      log(`[Hook:mandatory:${phaseKey}] Running (attempt ${attempt}/${attempts}): ${command}`);
      const result = await runShellCommand(command, cwd, timeoutMs);
      if (!result.timedOut && result.code === 0) {
        lastDetail = "";
        break;
      }

      const stderr = result.stderr.trim();
      const stdout = result.stdout.trim();
      lastDetail = result.timedOut ? `Timed out after ${timeoutMs}ms` : stderr || stdout || "unknown error";
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }

    if (lastDetail) {
      throw new UserError(`Mandatory hook failed (${phaseKey}): ${command}\n${lastDetail}`);
    }
  }
}
