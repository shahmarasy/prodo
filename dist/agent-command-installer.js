"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_ALIASES = void 0;
exports.resolveAi = resolveAi;
exports.installAgentCommands = installAgentCommands;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const errors_1 = require("./errors");
const utils_1 = require("./utils");
exports.AI_ALIASES = {
    codex: "codex",
    gemini: "gemini-cli",
    "gemmini-cli": "gemini-cli",
    "gemmini": "gemini-cli",
    "gemini-cli": "gemini-cli",
    claude: "claude-cli",
    "claude-cli": "claude-cli"
};
const AGENT_CONFIG = {
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
function parseFrontmatter(content) {
    if (!content.startsWith("---"))
        return { frontmatter: {}, body: content };
    const end = content.indexOf("\n---", 4);
    if (end === -1)
        return { frontmatter: {}, body: content };
    const fmRaw = content.slice(3, end).trim();
    const body = content.slice(end + 4).trimStart();
    const frontmatter = js_yaml_1.default.load(fmRaw) ?? {};
    return { frontmatter, body };
}
function renderFrontmatter(frontmatter) {
    if (Object.keys(frontmatter).length === 0)
        return "";
    return `---\n${js_yaml_1.default.dump(frontmatter)}---\n`;
}
function resolveScriptBlock(frontmatter, argsPlaceholder) {
    const run = frontmatter.run;
    const runAction = typeof run?.action === "string" ? run.action.trim() : "";
    const runMode = typeof run?.mode === "string" ? run.mode.trim() : "";
    if (runAction) {
        const modeSuffix = runMode ? ` (${runMode})` : "";
        return `- Internal action: ${runAction}${modeSuffix}`;
    }
    const runCommand = typeof run?.command === "string" ? run.command.replace("{ARGS}", argsPlaceholder) : "";
    if (runCommand) {
        return `- Command: ${runCommand}`;
    }
    const scripts = frontmatter.scripts;
    const sh = typeof scripts?.sh === "string" ? scripts.sh.replace("{ARGS}", argsPlaceholder) : "";
    const ps = typeof scripts?.ps === "string" ? scripts.ps.replace("{ARGS}", argsPlaceholder) : "";
    return [`- Bash: ${sh}`, `- PowerShell: ${ps}`].filter((line) => line.length > 8).join("\n");
}
function toTomlPrompt(body, frontmatter, argsPlaceholder) {
    const description = String(frontmatter.description ?? "Prodo command");
    const scriptsBlock = resolveScriptBlock(frontmatter, argsPlaceholder);
    const promptBody = body.replaceAll("$ARGUMENTS", argsPlaceholder);
    return `description = "${description.replace(/"/g, '\\"')}"

prompt = """
${promptBody}

Script options:
${scriptsBlock}
"""`;
}
function toSkill(name, body, frontmatter) {
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
function resolveAi(ai) {
    if (!ai)
        return undefined;
    const normalized = exports.AI_ALIASES[ai.trim().toLowerCase()];
    if (!normalized) {
        throw new errors_1.UserError("Unsupported --ai value. Use: codex | gemini-cli | claude-cli");
    }
    return normalized;
}
async function loadCommandTemplateNames(commandTemplatesDir) {
    if (!(await (0, utils_1.fileExists)(commandTemplatesDir))) {
        throw new errors_1.UserError(`Missing command templates directory: ${commandTemplatesDir}`);
    }
    const entries = await promises_1.default.readdir(commandTemplatesDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name.endsWith(".md") && name.startsWith("prodo-"))
        .map((name) => name.replace(/\.md$/, ""))
        .sort();
}
async function installAgentCommands(projectRoot, ai) {
    const cfg = AGENT_CONFIG[ai];
    const target = node_path_1.default.join(projectRoot, cfg.baseDir);
    const commandTemplatesDir = node_path_1.default.join(projectRoot, ".prodo", "commands");
    const commandNames = await loadCommandTemplateNames(commandTemplatesDir);
    await (0, utils_1.ensureDir)(target);
    const written = [];
    for (const commandName of commandNames) {
        const templatePath = node_path_1.default.join(commandTemplatesDir, `${commandName}.md`);
        if (!(await (0, utils_1.fileExists)(templatePath))) {
            throw new errors_1.UserError(`Missing command template: ${templatePath}`);
        }
        const raw = await promises_1.default.readFile(templatePath, "utf8");
        const parsed = parseFrontmatter(raw);
        if (cfg.format === "skill") {
            const skillDir = node_path_1.default.join(target, commandName);
            await (0, utils_1.ensureDir)(skillDir);
            const outPath = node_path_1.default.join(skillDir, "SKILL.md");
            const content = toSkill(commandName, parsed.body.replaceAll("$ARGUMENTS", cfg.argsPlaceholder), parsed.frontmatter);
            await promises_1.default.writeFile(outPath, content, "utf8");
            written.push(outPath);
            continue;
        }
        if (cfg.format === "toml") {
            const outPath = node_path_1.default.join(target, `${commandName}${cfg.extension}`);
            await promises_1.default.writeFile(outPath, toTomlPrompt(parsed.body, parsed.frontmatter, cfg.argsPlaceholder), "utf8");
            written.push(outPath);
            continue;
        }
        const outPath = node_path_1.default.join(target, `${commandName}${cfg.extension}`);
        const replacedBody = parsed.body.replaceAll("$ARGUMENTS", cfg.argsPlaceholder);
        await promises_1.default.writeFile(outPath, `${renderFrontmatter(parsed.frontmatter)}\n${replacedBody}`, "utf8");
        written.push(outPath);
    }
    return written;
}
