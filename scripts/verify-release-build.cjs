#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mustExist(filePath, label) {
  if (!(await exists(filePath))) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

async function runNode(args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Command failed (${args.join(" ")}): ${stderr}`));
    });
  });
}

async function verify() {
  const root = path.resolve(__dirname, "..");
  await mustExist(path.join(root, "dist", "cli.js"), "compiled CLI");
  await mustExist(path.join(root, "templates", "commands", "prodo-normalize.md"), "command template");
  await mustExist(path.join(root, "templates", "artifacts", "prd.md"), "artifact template");

  for (const preset of ["fintech", "saas", "marketplace"]) {
    await mustExist(path.join(root, "presets", preset, "preset.json"), `preset manifest (${preset})`);
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "prodo-release-check-"));
  try {
    await runNode([path.join(root, "dist", "cli.js"), "init", tmp], root);
    await mustExist(path.join(tmp, ".prodo", "commands", "prodo-normalize.md"), "scaffold command output");
    await mustExist(path.join(tmp, ".prodo", "registry.json"), "scaffold registry output");
    await mustExist(path.join(tmp, ".prodo", "state", "index.json"), "scaffold output index");
    await mustExist(path.join(tmp, "brief.md"), "project brief");
    await mustExist(path.join(tmp, "product-docs"), "artifact root");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

verify()
  .then(() => {
    process.stdout.write("release verification passed\n");
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

