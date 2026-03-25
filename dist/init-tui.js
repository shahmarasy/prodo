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
const errors_1 = require("./errors");
const utils_1 = require("./utils");
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
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".agents")))
        return "codex";
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".gemini")))
        return "gemini-cli";
    if (await (0, utils_1.fileExists)(node_path_1.default.join(projectRoot, ".claude")))
        return "claude-cli";
    return undefined;
}
function normalizeLang(lang) {
    if ((lang ?? "").trim().toLowerCase().startsWith("tr"))
        return "tr";
    return "en";
}
function modelChoiceFromAi(ai) {
    if (ai === "codex")
        return "codex";
    if (ai === "gemini-cli")
        return "gemini";
    return "auto-detect";
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
        // ignore lookup errors and continue with fallback
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
    const initialModel = modelChoiceFromAi(parsedAi ?? detectedAi);
    const projectName = node_path_1.default.basename(options.projectRoot) || ".";
    const width = terminalWidth();
    const subtitle = color("Prodo — Product Artifact Toolkit", "\u001B[1;37m");
    const signature = color("Crafted by Codex, guided by Shahmarasy intelligence", "\u001B[38;5;244m");
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
    const model = await clack.select({
        message: "Select model",
        initialValue: initialModel,
        options: [
            { value: "codex", label: "codex", hint: "Native Codex flow" },
            { value: "gemini", label: "gemini", hint: "Gemini CLI command set" },
            { value: "auto-detect", label: "auto-detect", hint: "Detect from local agent directories" }
        ]
    });
    if (clack.isCancel(model)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    const lang = await clack.select({
        message: "Select language",
        initialValue: defaultLang,
        options: [
            { value: "tr", label: "tr", hint: "Turkish" },
            { value: "en", label: "en", hint: "English" }
        ]
    });
    if (clack.isCancel(lang)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    const author = await clack.text({
        message: "Author name",
        placeholder: "Shahmarasy",
        defaultValue: defaultAuthor
    });
    if (clack.isCancel(author)) {
        clack.cancel("Initialization cancelled.");
        throw new errors_1.UserError("Initialization cancelled.");
    }
    let selectedAi;
    if (model === "codex")
        selectedAi = "codex";
    else if (model === "gemini")
        selectedAi = "gemini-cli";
    else
        selectedAi = detectedAi;
    return {
        ai: selectedAi,
        script: fallbackScript,
        lang,
        author: String(author).trim() || defaultAuthor,
        interactive: true
    };
}
function finishInitInteractive(summary) {
    const aiText = summary.ai ?? "none";
    return loadClack().then((clack) => clack.outro(`Scaffold complete.\nAI: ${aiText}\nLanguage: ${summary.lang}\nAuthor: ${summary.author}\nSettings: ${summary.settingsPath}\nNext: edit brief.md`));
}
