"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDoctor = runDoctor;
const node_child_process_1 = require("node:child_process");
const agent_registry_1 = require("../agents/agent-registry");
const paths_1 = require("../core/paths");
const utils_1 = require("../core/utils");
const version_1 = require("../core/version");
function termWidth() {
    return Math.max(80, process.stdout.columns ?? 100);
}
function stripAnsi(input) {
    return input.replace(/\u001B\[[0-9;]*m/g, "");
}
function color(input, code) {
    if (!process.stdout.isTTY)
        return input;
    return `${code}${input}\u001B[0m`;
}
function center(input, width) {
    const visible = stripAnsi(input).length;
    const left = Math.max(0, Math.floor((width - visible) / 2));
    return `${" ".repeat(left)}${input}`;
}
function iconFor(status) {
    if (status === "available")
        return color("✔", "\u001B[32m");
    if (status === "not_found")
        return color("✖", "\u001B[31m");
    return color("•", "\u001B[33m");
}
function labelFor(status) {
    if (status === "available")
        return color("available", "\u001B[32m");
    if (status === "not_found")
        return color("not found", "\u001B[31m");
    return color("IDE-based", "\u001B[2;33m");
}
function renderRows(rows) {
    const leftWidth = Math.max(...rows.map((row) => row.name.length), 10);
    return rows.map((row) => {
        const left = row.name.padEnd(leftWidth, " ");
        const status = `${labelFor(row.status)}${row.detail ? ` (${row.detail})` : ""}`;
        return ` ${iconFor(row.status)}  ${left}  ${status}`;
    });
}
async function commandExists(command) {
    return new Promise((resolve) => {
        const lookup = process.platform === "win32" ? "where" : "which";
        const child = (0, node_child_process_1.spawn)(lookup, [command], { stdio: "ignore" });
        child.on("error", () => resolve(false));
        child.on("close", (code) => resolve(code === 0));
    });
}
async function firstAvailable(commands) {
    for (const command of commands) {
        if (await commandExists(command))
            return true;
    }
    return false;
}
function renderLogo(width) {
    const cyan = "\u001B[38;5;45m";
    const blue = "\u001B[38;5;39m";
    const logo = [
        "██████╗ ██████╗  ██████╗ ██████╗  ██████╗ ",
        "██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗",
        "██████╔╝██████╔╝██║   ██║██║  ██║██║   ██║",
        "██╔═══╝ ██╔══██╗██║   ██║██║  ██║██║   ██║",
        "██║     ██║  ██║╚██████╔╝██████╔╝╚██████╔╝"
    ];
    const painted = logo.map((line, idx) => color(line, idx % 2 === 0 ? cyan : blue));
    return painted.map((line) => center(line, width)).join("\n");
}
async function runDoctor(cwd, out) {
    const width = termWidth();
    const version = await (0, version_1.readCliVersion)(cwd);
    const isInitialized = await (0, utils_1.fileExists)((0, paths_1.prodoPath)(cwd));
    const codex = await firstAvailable(["codex"]);
    const gemini = await firstAvailable(["gemini", "gemini-cli"]);
    const claude = await firstAvailable(["claude", "claude-cli"]);
    const git = await firstAvailable(["git"]);
    const node = await firstAvailable(["node"]);
    const vscode = await firstAvailable(["code"]);
    const coreRows = [
        { name: "Prodo CLI", status: "available", detail: `v${version}` },
        {
            name: "Project initialized",
            status: isInitialized ? "available" : "not_found",
            detail: isInitialized ? ".prodo found" : ".prodo missing"
        }
    ];
    const aiCliRows = [
        { name: "Codex CLI", status: codex ? "available" : "not_found", detail: codex ? "available" : "not found" },
        { name: "Gemini CLI", status: gemini ? "available" : "not_found", detail: gemini ? "available" : "not found" },
        { name: "Claude CLI", status: claude ? "available" : "not_found", detail: claude ? "available" : "not found" }
    ];
    const registry = (0, agent_registry_1.getGlobalRegistry)();
    const agentRows = [];
    for (const agent of registry.list()) {
        if (agent.name === "mock")
            continue;
        const available = await agent.isAvailable();
        const config = agent.getConfig();
        const sdkLabel = config.sdkRequired ? `SDK: ${config.sdkRequired}` : "";
        const envLabel = config.envVars.filter((v) => !process.env[v]).map((v) => `${v} missing`).join(", ");
        const detail = available ? "ready" : [sdkLabel, envLabel].filter(Boolean).join(", ") || "not configured";
        agentRows.push({
            name: config.displayName,
            status: available ? "available" : "not_found",
            detail
        });
    }
    const devRows = [
        { name: "Git", status: git ? "available" : "not_found", detail: git ? "available" : "not found" },
        { name: "Node.js", status: node ? "available" : "not_found", detail: node ? "available" : "not found" },
        { name: "Visual Studio Code", status: vscode ? "available" : "not_found", detail: vscode ? "available" : "not found" },
        { name: "Cursor", status: "ide", detail: "IDE-based, no CLI check" }
    ];
    out("");
    out(renderLogo(width));
    out("");
    out(center(color("Prodo — AI-Powered Product Owner", "\u001B[1;37m"), width));
    out(center(color("Built by Shahmarasy · Works with Claude, Codex, and Gemini", "\u001B[2;37m"), width));
    out("");
    out("Checking environment...");
    out("");
    out(color("Core", "\u001B[1m"));
    for (const line of renderRows(coreRows))
        out(line);
    out("");
    out(color("AI CLI Tools", "\u001B[1m"));
    for (const line of renderRows(aiCliRows))
        out(line);
    out("");
    out(color("LLM Agents (SDK)", "\u001B[1m"));
    for (const line of renderRows(agentRows))
        out(line);
    out("");
    out(color("Dev Tools", "\u001B[1m"));
    for (const line of renderRows(devRows))
        out(line);
    out("");
}
