import path from "node:path";
import { spawn } from "node:child_process";
import { getGlobalRegistry } from "../agents/agent-registry";
import { prodoPath } from "../core/paths";
import { fileExists } from "../core/utils";
import { readCliVersion } from "../core/version";

type RowStatus = "available" | "not_found" | "ide";

type DoctorRow = {
  name: string;
  status: RowStatus;
  detail: string;
};

function termWidth(): number {
  return Math.max(80, process.stdout.columns ?? 100);
}

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function color(input: string, code: string): string {
  if (!process.stdout.isTTY) return input;
  return `${code}${input}\u001B[0m`;
}

function center(input: string, width: number): string {
  const visible = stripAnsi(input).length;
  const left = Math.max(0, Math.floor((width - visible) / 2));
  return `${" ".repeat(left)}${input}`;
}

function iconFor(status: RowStatus): string {
  if (status === "available") return color("✔", "\u001B[32m");
  if (status === "not_found") return color("✖", "\u001B[31m");
  return color("•", "\u001B[33m");
}

function labelFor(status: RowStatus): string {
  if (status === "available") return color("available", "\u001B[32m");
  if (status === "not_found") return color("not found", "\u001B[31m");
  return color("IDE-based", "\u001B[2;33m");
}

function renderRows(rows: DoctorRow[]): string[] {
  const leftWidth = Math.max(...rows.map((row) => row.name.length), 10);
  return rows.map((row) => {
    const left = row.name.padEnd(leftWidth, " ");
    const status = `${labelFor(row.status)}${row.detail ? ` (${row.detail})` : ""}`;
    return ` ${iconFor(row.status)}  ${left}  ${status}`;
  });
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const lookup = process.platform === "win32" ? "where" : "which";
    const child = spawn(lookup, [command], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function firstAvailable(commands: string[]): Promise<boolean> {
  for (const command of commands) {
    if (await commandExists(command)) return true;
  }
  return false;
}

function renderLogo(width: number): string {
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

export async function runDoctor(cwd: string, out: (line: string) => void): Promise<void> {
  const width = termWidth();
  const version = await readCliVersion(cwd);
  const isInitialized = await fileExists(prodoPath(cwd));

  const codex = await firstAvailable(["codex"]);
  const gemini = await firstAvailable(["gemini", "gemini-cli"]);
  const claude = await firstAvailable(["claude", "claude-cli"]);

  const git = await firstAvailable(["git"]);
  const node = await firstAvailable(["node"]);
  const vscode = await firstAvailable(["code"]);

  const coreRows: DoctorRow[] = [
    { name: "Prodo CLI", status: "available", detail: `v${version}` },
    {
      name: "Project initialized",
      status: isInitialized ? "available" : "not_found",
      detail: isInitialized ? ".prodo found" : ".prodo missing"
    }
  ];

  const aiCliRows: DoctorRow[] = [
    { name: "Codex CLI", status: codex ? "available" : "not_found", detail: codex ? "available" : "not found" },
    { name: "Gemini CLI", status: gemini ? "available" : "not_found", detail: gemini ? "available" : "not found" },
    { name: "Claude CLI", status: claude ? "available" : "not_found", detail: claude ? "available" : "not found" }
  ];

  const registry = getGlobalRegistry();
  const agentRows: DoctorRow[] = [];
  for (const agent of registry.list()) {
    if (agent.name === "mock") continue;
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

  const devRows: DoctorRow[] = [
    { name: "Git", status: git ? "available" : "not_found", detail: git ? "available" : "not found" },
    { name: "Node.js", status: node ? "available" : "not_found", detail: node ? "available" : "not found" },
    { name: "Visual Studio Code", status: vscode ? "available" : "not_found", detail: vscode ? "available" : "not found" },
    { name: "Cursor", status: "ide", detail: "IDE-based, no CLI check" }
  ];

  out("");
  out(renderLogo(width));
  out("");
  out(center(color("Prodo — Product Artifact Toolkit", "\u001B[1;37m"), width));
  out(center(color("Crafted by Codex, guided by Shahmarasy intelligence", "\u001B[2;37m"), width));
  out("");
  out("Checking environment...");
  out("");
  out(color("Core", "\u001B[1m"));
  for (const line of renderRows(coreRows)) out(line);
  out("");
  out(color("AI CLI Tools", "\u001B[1m"));
  for (const line of renderRows(aiCliRows)) out(line);
  out("");
  out(color("LLM Agents (SDK)", "\u001B[1m"));
  for (const line of renderRows(agentRows)) out(line);
  out("");
  out(color("Dev Tools", "\u001B[1m"));
  for (const line of renderRows(devRows)) out(line);
  out("");
}
