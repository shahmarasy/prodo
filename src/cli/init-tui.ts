import path from "node:path";
import os from "node:os";
import { resolveAi, type SupportedAi } from "./agent-command-installer";
import { UserError } from "../core/errors";
import { fileExists } from "../core/utils";

export type InitSelections = {
  ai?: SupportedAi;
  provider?: string;
  script: "sh" | "ps";
  lang: string;
  author: string;
  interactive: boolean;
};

type GatherInitUiOptions = {
  projectRoot: string;
  aiInput?: string;
  langInput?: string;
  authorInput?: string;
};

type ClackPrompts = typeof import("@clack/prompts");

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

async function loadClack(): Promise<ClackPrompts> {
  return (await dynamicImport("@clack/prompts")) as ClackPrompts;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

function color(text: string, code: string): string {
  return `${code}${text}\u001B[0m`;
}

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function centerLine(line: string, width: number): string {
  const visible = stripAnsi(line).length;
  const left = Math.max(0, Math.floor((width - visible) / 2));
  return `${" ".repeat(left)}${line}`;
}

function centerBlock(lines: string[], width: number): string {
  return lines.map((line) => centerLine(line, width)).join("\n");
}

function terminalWidth(): number {
  const columns = process.stdout.columns ?? 100;
  return Math.max(80, columns);
}

function renderLogo(): string {
  const cyan = "\u001B[38;5;45m";
  const blue = "\u001B[38;5;39m";
  const lines = [
    "██████╗ ██████╗  ██████╗ ██████╗  ██████╗ ",
    "██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗",
    "██████╔╝██████╔╝██║   ██║██║  ██║██║   ██║",
    "██╔═══╝ ██╔══██╗██║   ██║██║  ██║██║   ██║",
    "██║     ██║  ██║╚██████╔╝██████╔╝╚██████╔╝"
  ];
  return lines.map((line, idx) => color(line, idx % 2 === 0 ? cyan : blue)).join("\n");
}

function renderProjectBox(projectName: string, projectRoot: string): string {
  const content = [`Project   ${projectName}`, `Directory ${projectRoot}`];
  const innerWidth = Math.max(...content.map((line) => line.length)) + 2;
  const top = `┌${"─".repeat(innerWidth)}┐`;
  const rows = content.map((line) => `│ ${line.padEnd(innerWidth - 1)}│`);
  const bottom = `└${"─".repeat(innerWidth)}┘`;
  return [top, ...rows, bottom].join("\n");
}

async function detectAi(projectRoot: string): Promise<SupportedAi | undefined> {
  if (await fileExists(path.join(projectRoot, ".agents"))) return "codex";
  if (await fileExists(path.join(projectRoot, ".gemini"))) return "gemini-cli";
  if (await fileExists(path.join(projectRoot, ".claude"))) return "claude-cli";
  return undefined;
}

function normalizeLang(lang?: string): string {
  const raw = (lang ?? "").trim().toLowerCase();
  if (raw.startsWith("tr")) return "tr";
  return "en";
}

function defaultAuthorName(authorInput?: string): string {
  const explicit = (authorInput ?? "").trim();
  if (explicit.length > 0) return explicit;
  try {
    const username = os.userInfo().username.trim();
    if (username.length > 0) return username;
  } catch {
    // ignore
  }
  return "Product Author";
}

export async function gatherInitSelections(options: GatherInitUiOptions): Promise<InitSelections> {
  const clack = await loadClack();
  const defaultLang = normalizeLang(options.langInput);
  const fallbackScript: "sh" | "ps" = process.platform === "win32" ? "ps" : "sh";
  const parsedAi = resolveAi(options.aiInput);
  const defaultAuthor = defaultAuthorName(options.authorInput);

  if (!isInteractiveTerminal()) {
    return {
      ai: parsedAi,
      script: fallbackScript,
      lang: defaultLang,
      author: defaultAuthor,
      interactive: false
    };
  }

  const detectedAi = await detectAi(options.projectRoot);
  const projectName = path.basename(options.projectRoot) || ".";
  const width = terminalWidth();
  const subtitle = color("Prodo — AI-Powered Product Owner", "\u001B[1;37m");
  const signature = color("Built by Shahmarasy · Works with Claude, Codex, and Gemini", "\u001B[38;5;244m");
  const hero = [
    "",
    centerBlock(renderLogo().split("\n"), width),
    "",
    centerLine(subtitle, width),
    centerLine(signature, width),
    ""
  ].join("\n");

  clack.intro(hero);
  clack.note(renderProjectBox(projectName, options.projectRoot), "Project Setup");

  const agentChoice = await clack.select({
    message: "Select AI agent (command installer)",
    initialValue: parsedAi ?? detectedAi ?? "claude-cli",
    options: [
      { value: "claude-cli", label: "Claude CLI", hint: "Claude Code slash commands (.claude/commands/)" },
      { value: "codex", label: "Codex", hint: "Codex skills (.agents/skills/)" },
      { value: "gemini-cli", label: "Gemini CLI", hint: "Gemini CLI commands (.gemini/commands/)" },
      { value: "none", label: "None", hint: "Skip agent command installation" }
    ]
  });
  if (clack.isCancel(agentChoice)) {
    clack.cancel("Initialization cancelled.");
    throw new UserError("Initialization cancelled.");
  }

  const providerChoice = await clack.select({
    message: "Select LLM provider (for document generation)",
    initialValue: "openai",
    options: [
      { value: "openai", label: "OpenAI", hint: "GPT-4o-mini (requires OPENAI_API_KEY)" },
      { value: "anthropic", label: "Anthropic Claude", hint: "Claude Sonnet (requires ANTHROPIC_API_KEY)" },
      { value: "google", label: "Google Gemini", hint: "Gemini Flash (requires GOOGLE_API_KEY)" },
      { value: "mock", label: "Mock (offline)", hint: "No AI calls — template-based generation for testing" }
    ]
  });
  if (clack.isCancel(providerChoice)) {
    clack.cancel("Initialization cancelled.");
    throw new UserError("Initialization cancelled.");
  }

  const lang = await clack.select({
    message: "Select document language",
    initialValue: defaultLang,
    options: [
      { value: "en", label: "English", hint: "English output" },
      { value: "tr", label: "Türkçe", hint: "Turkish output" }
    ]
  });
  if (clack.isCancel(lang)) {
    clack.cancel("Initialization cancelled.");
    throw new UserError("Initialization cancelled.");
  }

  const author = await clack.text({
    message: "Author name",
    placeholder: "Your name",
    defaultValue: defaultAuthor
  });
  if (clack.isCancel(author)) {
    clack.cancel("Initialization cancelled.");
    throw new UserError("Initialization cancelled.");
  }

  const selectedAi = agentChoice === "none" ? undefined : (agentChoice as SupportedAi);

  return {
    ai: selectedAi,
    provider: String(providerChoice),
    script: fallbackScript,
    lang: String(lang),
    author: String(author).trim() || defaultAuthor,
    interactive: true
  };
}

export function finishInitInteractive(summary: {
  projectRoot: string;
  settingsPath: string;
  ai?: SupportedAi;
  provider?: string;
  lang: string;
  author: string;
}): Promise<void> {
  const aiText = summary.ai ?? "none";
  const providerText = summary.provider ?? "mock";
  return loadClack().then((clack) => clack.outro(
    `Scaffold complete.\n` +
    `AI Agent: ${aiText}\n` +
    `LLM Provider: ${providerText}\n` +
    `Language: ${summary.lang}\n` +
    `Author: ${summary.author}\n` +
    `Settings: ${summary.settingsPath}\n` +
    `\nNext steps:\n` +
    `  1. Edit brief.md with your product description\n` +
    `  2. Run: prodo generate\n` +
    `  3. Review generated docs in product-docs/`
  ));
}
