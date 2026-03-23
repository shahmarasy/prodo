import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { UserError } from "./errors";
import { ensureDir, fileExists } from "./utils";

export const AI_ALIASES: Record<string, "codex" | "gemini-cli" | "claude-cli"> = {
  codex: "codex",
  gemini: "gemini-cli",
  "gemmini-cli": "gemini-cli",
  "gemmini": "gemini-cli",
  "gemini-cli": "gemini-cli",
  claude: "claude-cli",
  "claude-cli": "claude-cli"
};

export type SupportedAi = "codex" | "gemini-cli" | "claude-cli";

type AgentConfig = {
  baseDir: string;
  format: "markdown" | "toml" | "skill";
  extension: string;
  argsPlaceholder: string;
};

const AGENT_CONFIG: Record<SupportedAi, AgentConfig> = {
  "claude-cli": {
    baseDir: ".claude/commands",
    format: "markdown",
    extension: ".md",
    argsPlaceholder: "$ARGUMENTS"
  },
  "gemini-cli": {
    baseDir: ".gemini/commands",
    format: "toml",
    extension: ".toml",
    argsPlaceholder: "{{args}}"
  },
  codex: {
    baseDir: ".agents/skills",
    format: "skill",
    extension: "/SKILL.md",
    argsPlaceholder: "$ARGUMENTS"
  }
};

type ParsedTemplate = {
  frontmatter: Record<string, unknown>;
  body: string;
};

function parseFrontmatter(content: string): ParsedTemplate {
  if (!content.startsWith("---")) return { frontmatter: {}, body: content };
  const end = content.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: content };
  const fmRaw = content.slice(3, end).trim();
  const body = content.slice(end + 4).trimStart();
  const frontmatter = (yaml.load(fmRaw) as Record<string, unknown>) ?? {};
  return { frontmatter, body };
}

function renderFrontmatter(frontmatter: Record<string, unknown>): string {
  if (Object.keys(frontmatter).length === 0) return "";
  return `---\n${yaml.dump(frontmatter)}---\n`;
}

function sanitizeFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const out = { ...frontmatter };
  delete out.run;
  delete out.scripts;
  return out;
}

function toTomlPrompt(body: string, frontmatter: Record<string, unknown>, argsPlaceholder: string): string {
  const description = String(frontmatter.description ?? "Prodo command");
  const promptBody = body.replaceAll("$ARGUMENTS", argsPlaceholder);
  return `description = "${description.replace(/"/g, '\\"')}"

prompt = """
Important execution rule:
- This is an agent slash command, not a shell command.
- Do NOT run \`prodo-normalize\`, \`prodo-prd\`, or \`prodo ...\` in shell.
- Execute the workflow directly using workspace files.

${promptBody}
"""`;
}

function toSkill(name: string, body: string, frontmatter: Record<string, unknown>): string {
  const description = String(frontmatter.description ?? "Prodo workflow command");
  return `---
name: ${name}
description: ${description}
compatibility: Requires Prodo project scaffold (.prodo)
metadata:
  author: prodo
  source: .prodo/commands/${name}.md
---

${body}`;
}

export function resolveAi(ai?: string): SupportedAi | undefined {
  if (!ai) return undefined;
  const normalized = AI_ALIASES[ai.trim().toLowerCase()];
  if (!normalized) {
    throw new UserError("Unsupported --ai value. Use: codex | gemini-cli | claude-cli");
  }
  return normalized;
}

async function loadCommandTemplateNames(commandTemplatesDir: string): Promise<string[]> {
  if (!(await fileExists(commandTemplatesDir))) {
    throw new UserError(`Missing command templates directory: ${commandTemplatesDir}`);
  }
  const entries = await fs.readdir(commandTemplatesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".md") && name.startsWith("prodo-"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

export async function installAgentCommands(projectRoot: string, ai: SupportedAi): Promise<string[]> {
  const cfg = AGENT_CONFIG[ai];
  const target = path.join(projectRoot, cfg.baseDir);
  const commandTemplatesDir = path.join(projectRoot, ".prodo", "commands");
  const commandNames = await loadCommandTemplateNames(commandTemplatesDir);
  await ensureDir(target);

  const written: string[] = [];
  for (const commandName of commandNames) {
    const templatePath = path.join(commandTemplatesDir, `${commandName}.md`);
    if (!(await fileExists(templatePath))) {
      throw new UserError(`Missing command template: ${templatePath}`);
    }
    const raw = await fs.readFile(templatePath, "utf8");
    const parsed = parseFrontmatter(raw);

    if (cfg.format === "skill") {
      const skillDir = path.join(target, commandName);
      await ensureDir(skillDir);
      const outPath = path.join(skillDir, "SKILL.md");
      const content = toSkill(commandName, parsed.body.replaceAll("$ARGUMENTS", cfg.argsPlaceholder), parsed.frontmatter);
      await fs.writeFile(outPath, content, "utf8");
      written.push(outPath);
      continue;
    }

    if (cfg.format === "toml") {
      const outPath = path.join(target, `${commandName}${cfg.extension}`);
      await fs.writeFile(outPath, toTomlPrompt(parsed.body, parsed.frontmatter, cfg.argsPlaceholder), "utf8");
      written.push(outPath);
      continue;
    }

    const outPath = path.join(target, `${commandName}${cfg.extension}`);
    const replacedBody = parsed.body.replaceAll("$ARGUMENTS", cfg.argsPlaceholder);
    await fs.writeFile(outPath, `${renderFrontmatter(sanitizeFrontmatter(parsed.frontmatter))}\n${replacedBody}`, "utf8");
    written.push(outPath);
  }
  return written;
}
