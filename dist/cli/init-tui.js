"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatherInitSelections = gatherInitSelections;
exports.finishInitInteractive = finishInitInteractive;
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const agent_command_installer_1 = require("./agent-command-installer");
const errors_1 = require("../core/errors");
const utils_1 = require("../core/utils");
const dynamicImport = new Function("specifier", "return import(specifier)");
async function loadClack() {
    return (await dynamicImport("@clack/prompts"));
}
function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}
function color(text, code) {
    return `${code}${text}\u001B[0m`;
}
function stripAnsi(input) {
    return input.replace(/\u001B\[[0-9;]*m/g, "");
}
function centerLine(line, width) {
    const visible = stripAnsi(line).length;
    const left = Math.max(0, Math.floor((width - visible) / 2));
    return `${" ".repeat(left)}${line}`;
}
function centerBlock(lines, width) {
    return lines.map((line) => centerLine(line, width)).join("\n");
}
function terminalWidth() {
    const columns = process.stdout.columns ?? 100;
    return Math.max(80, columns);
}
function renderLogo() {
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
function renderProjectBox(projectName, projectRoot) {
    const content = [`Project   ${projectName}`, `Directory ${projectRoot}`];
    const innerWidth = Math.max(...content.map((line) => line.length)) + 2;
    const top = `┌${"─".repeat(innerWidth)}┐`;
    const rows = content.map((line) => `│ ${line.padEnd(innerWidth - 1)}│`);
    const bottom = `└${"─".repeat(innerWidth)}┘`;
    return [top, ...rows, bottom].join("\n");
}
async function detectAi(projectRoot) {
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".claude")))
        return "claude-cli";
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".agents")))
        return "codex";
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".gemini")))
        return "gemini-cli";
    return undefined;
}
function normalizeLang(lang) {
    const raw = (lang ?? "").trim().toLowerCase();
    if (raw.startsWith("tr"))
        return "tr";
    return "en";
}
function defaultAuthorName(authorInput) {
    const explicit = (authorInput ?? "").trim();
    if (explicit.length > 0)
        return explicit;
    try {
        const username = node_os_1.default.userInfo().username.trim();
        if (username.length > 0)
            return username;
    }
    catch {
        // ignore
    }
    return "Product Author";
}
async function gatherInitSelections(options) {
    const clack = await loadClack();
    const defaultLang = normalizeLang(options.langInput);
    const fallbackScript = process.platform === "win32" ? "ps" : "sh";
    const parsedAi = (0, agent_command_installer_1.resolveAi)(options.aiInput);
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
    const projectName = node_path_1.default.basename(options.projectRoot) || ".";
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
        message: "Which AI agent will you use?",
        initialValue: parsedAi ?? detectedAi ?? "claude-cli",
        options: [
            { value: "claude-cli", label: "Claude Code", hint: "Slash commands → .claude/commands/" },
            { value: "codex", label: "Codex", hint: "Skills → .agents/skills/" },
            { value: "gemini-cli", label: "Gemini CLI", hint: "Commands → .gemini/commands/" }
        ]
    });
    if (clack.isCancel(agentChoice)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    const lang = await clack.select({
        message: "Document language",
        initialValue: defaultLang,
        options: [
            { value: "en", label: "English" },
            { value: "tr", label: "Türkçe" }
        ]
    });
    if (clack.isCancel(lang)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    const author = await clack.text({
        message: "Author name",
        placeholder: "Your name",
        defaultValue: defaultAuthor
    });
    if (clack.isCancel(author)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    return {
        ai: agentChoice,
        script: fallbackScript,
        lang: String(lang),
        author: String(author).trim() || defaultAuthor,
        interactive: true
    };
}
function finishInitInteractive(summary) {
    const agentLabel = summary.ai === "claude-cli" ? "Claude Code"
        : summary.ai === "codex" ? "Codex"
            : summary.ai === "gemini-cli" ? "Gemini CLI"
                : "none";
    const commandPrefix = summary.ai === "codex" ? "$" : "/";
    const commands = [
        `${commandPrefix}prodo-normalize`,
        `${commandPrefix}prodo-prd`,
        `${commandPrefix}prodo-workflow`,
        `${commandPrefix}prodo-wireframe`,
        `${commandPrefix}prodo-stories`,
        `${commandPrefix}prodo-techspec`,
        `${commandPrefix}prodo-validate`
    ];
    return loadClack().then((clack) => clack.outro(`Scaffold complete!\n\n` +
        `  Agent:    ${agentLabel}\n` +
        `  Language: ${summary.lang}\n` +
        `  Author:   ${summary.author}\n\n` +
        `Next steps:\n` +
        `  1. Edit brief.md with your product description\n` +
        `  2. Open this folder in ${agentLabel}\n` +
        `  3. Run commands in sequence:\n` +
        `     ${commands.join("\n     ")}`));
}
