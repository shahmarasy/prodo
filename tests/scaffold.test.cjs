const test = require("node:test");
const assert = require("node:assert/strict");
const { runCli } = require("../dist/cli");
const { fs, path, makeTempDir, listFilesRecursive } = require("./helpers.cjs");

test("prodo-init creates scaffold", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  const logs = [];
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "init"],
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });

  assert.equal(code, 0);
  await fs.stat(path.join(cwd, "brief.md"));
  await fs.stat(path.join(cwd, ".prodo", "briefs", "normalized-brief.json"));
  await fs.stat(path.join(cwd, ".prodo", "settings.json"));
  await fs.stat(path.join(cwd, ".prodo", "init-options.json"));
  await fs.stat(path.join(cwd, ".prodo", "hooks.yml"));
  await fs.stat(path.join(cwd, ".prodo", "scaffold-manifest.json"));
  await fs.stat(path.join(cwd, ".prodo", "registry.json"));
  await fs.stat(path.join(cwd, ".prodo", "state", "index.json"));
  await fs.stat(path.join(cwd, ".prodo", "commands", "prodo-normalize.md"));
  await fs.stat(path.join(cwd, ".prodo", "templates", "prd.md"));
  await fs.stat(path.join(cwd, ".prodo", "templates", "workflow.mmd"));
  await fs.stat(path.join(cwd, ".prodo", "templates", "wireframe.html"));
  await assert.rejects(fs.stat(path.join(cwd, ".prodo", "agents")));
  await fs.stat(path.join(cwd, ".prodo", "presets"));

  const scaffoldManifest = JSON.parse(
    await fs.readFile(path.join(cwd, ".prodo", "scaffold-manifest.json"), "utf8")
  );
  assert.ok(Number.isInteger(scaffoldManifest.asset_count));
  assert.ok(Array.isArray(scaffoldManifest.assets));
  assert.ok(scaffoldManifest.parity_summary.match_count > 0);
  assert.equal(scaffoldManifest.parity_summary.drift_count, 0);
  assert.equal(scaffoldManifest.parity_summary.protected_count, 0);
  assert.match(logs.join("\n"), /Initialized Prodo scaffold/);
});

test("init scaffold parity matches repo core assets", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  const logs = [];
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "init"],
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });
  assert.equal(code, 0);

  const repoRoot = path.resolve(__dirname, "..");
  const pairs = [
    { source: path.join(repoRoot, "templates", "commands"), target: path.join(cwd, ".prodo", "commands") },
    { source: path.join(repoRoot, "templates", "artifacts"), target: path.join(cwd, ".prodo", "templates") }
  ];

  for (const pair of pairs) {
    const sourceFiles = await listFilesRecursive(pair.source);
    for (const src of sourceFiles) {
      const rel = path.relative(pair.source, src);
      const dst = path.join(pair.target, rel);
      const srcBuf = await fs.readFile(src);
      const dstBuf = await fs.readFile(dst);
      assert.equal(Buffer.compare(srcBuf, dstBuf), 0, `mismatch for ${rel}`);
    }
  }
});

test("init manifest protects user-modified scaffold files", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  const logs = [];
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);

  const driftFile = path.join(cwd, ".prodo", "commands", "prodo-normalize.md");
  const original = await fs.readFile(driftFile, "utf8");
  await fs.writeFile(driftFile, `${original}\n# local drift\n`, "utf8");

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  const manifest = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "scaffold-manifest.json"), "utf8"));
  assert.ok(manifest.parity_summary.protected_count > 0);
  assert.ok(manifest.assets.some((item) => item.status === "protected"));
});

test("init auto-updates unmanaged-free files when core assets change", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  const logs = [];
  const templatesDir = path.join(cwd, "templates", "commands");
  await fs.mkdir(templatesDir, { recursive: true });
  await fs.mkdir(path.join(cwd, "templates", "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(templatesDir, "prodo-normalize.md"),
    "---\ndescription: Custom normalize\nrun:\n  command: prodo normalize \"{ARGS}\"\n---\n\nInitial template body.\n",
    "utf8"
  );

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  await fs.writeFile(
    path.join(templatesDir, "prodo-normalize.md"),
    (await fs.readFile(path.join(templatesDir, "prodo-normalize.md"), "utf8")).replace("Initial", "Updated"),
    "utf8"
  );

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  const generated = await fs.readFile(path.join(cwd, ".prodo", "commands", "prodo-normalize.md"), "utf8");
  assert.match(generated, /Updated template body/);
});

test("init refreshes legacy internal-runtime command templates", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} }), 0);
  const commandPath = path.join(cwd, ".prodo", "commands", "prodo-prd.md");
  await fs.writeFile(
    commandPath,
    `---\ndescription: Generate PRD artifact.\nrun:\n  action: prd\n  mode: internal-runtime\n---\n\nlegacy body\n`,
    "utf8"
  );

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} }), 0);
  const refreshed = await fs.readFile(commandPath, "utf8");
  assert.doesNotMatch(refreshed, /run:\s*\n/);
  assert.doesNotMatch(refreshed, /action:\s*prd/);
  assert.doesNotMatch(refreshed, /mode:\s*internal-runtime/);
});

test("init recovers from corrupt registry and rewrites valid state", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  await fs.writeFile(path.join(cwd, ".prodo", "registry.json"), "{ not-valid-json", "utf8");
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);

  const registry = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "registry.json"), "utf8"));
  assert.equal(registry.schema_version, "1.0");
});

test("init registry persists override and installed preset state", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  await fs.writeFile(path.join(cwd, ".prodo", "templates", "overrides", "workflow.md"), "# Workflow Template\n\n## Primary Actors\n- Analyst\n", "utf8");
  await fs.mkdir(path.join(cwd, ".prodo", "presets"), { recursive: true });
  await fs.writeFile(path.join(cwd, ".prodo", "presets", "installed.json"), "[\"fintech\"]\n", "utf8");
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);

  const registry = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "registry.json"), "utf8"));
  assert.ok(registry.installed_overrides.some((entry) => entry.artifact_type === "workflow"));
  assert.ok(registry.installed_presets.includes("fintech"));
});

test("init applies presets with priority and compatibility checks", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await fs.mkdir(path.join(cwd, "presets", "base", "prompts"), { recursive: true });
  await fs.mkdir(path.join(cwd, "presets", "fintech", "prompts"), { recursive: true });
  await fs.writeFile(path.join(cwd, "presets", "base", "preset.json"), JSON.stringify({ name: "base", priority: 1, min_prodo_version: "0.0.1" }, null, 2), "utf8");
  await fs.writeFile(path.join(cwd, "presets", "fintech", "preset.json"), JSON.stringify({ name: "fintech", priority: 5, min_prodo_version: "0.0.1" }, null, 2), "utf8");
  await fs.writeFile(path.join(cwd, "presets", "base", "prompts", "prd.md"), "BASE PROMPT\n", "utf8");
  await fs.writeFile(path.join(cwd, "presets", "fintech", "prompts", "prd.md"), "FINTECH PROMPT\n", "utf8");
  await fs.writeFile(path.join(cwd, "prodo.config.json"), JSON.stringify({ presets: ["base", "fintech"] }, null, 2), "utf8");

  const code = await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  assert.match(await fs.readFile(path.join(cwd, ".prodo", "prompts", "prd.md"), "utf8"), /FINTECH PROMPT/);
});

test("init installs command packs and agent installer picks dynamic commands", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await fs.mkdir(path.join(cwd, "command-packs", "research", "commands"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "command-packs", "research", "commands", "prodo-research.md"),
    "---\ndescription: Research command\nrun:\n  command: prodo validate \"{ARGS}\"\n---\n\nResearch with $ARGUMENTS.\n",
    "utf8"
  );
  await fs.writeFile(path.join(cwd, "prodo.config.json"), JSON.stringify({ command_packs: ["research"] }, null, 2), "utf8");

  const code = await runCli({ cwd, argv: ["node", "prodo", "init", ".", "--ai", "gemini-cli"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  await fs.stat(path.join(cwd, ".prodo", "commands", "prodo-research.md"));
  await fs.stat(path.join(cwd, ".gemini", "commands", "prodo-research.toml"));
});

test("dynamic artifact registry from project config is routable without new CLI surface", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await fs.writeFile(
    path.join(cwd, "prodo.config.json"),
    JSON.stringify({
      artifacts: [{ name: "gtm", output_dir: "gtm", required_headings: ["## Plan", "## Channels"], upstream: ["prd"], required_contracts: ["goals"] }]
    }, null, 2),
    "utf8"
  );

  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} }), 0);
  await fs.stat(path.join(cwd, ".prodo", "commands", "prodo-gtm.md"));
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "gtm"], log: () => {}, error: () => {} }), 0);
  const gtmFiles = await fs.readdir(path.join(cwd, "product-docs", "gtm"));
  assert.ok(gtmFiles.length > 0);
});

test("init with --ai gemini-cli installs gemini command files", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const code = await runCli({ cwd, argv: ["node", "prodo", "init", ".", "--ai", "gemini-cli"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  await fs.stat(path.join(cwd, ".gemini", "commands", "prodo-normalize.toml"));
});

test("agent installer discovers custom command templates dynamically", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(
    path.join(cwd, ".prodo", "commands", "prodo-custom.md"),
    `---\ndescription: Custom command\nrun:\n  command: prodo validate "{ARGS}"\n---\n\nRun custom command with $ARGUMENTS.\n`,
    "utf8"
  );
  const code = await runCli({ cwd, argv: ["node", "prodo", "init", ".", "--ai", "gemini-cli"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  await fs.stat(path.join(cwd, ".gemini", "commands", "prodo-custom.toml"));
});

test("init with --lang tr stores language setting", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const code = await runCli({ cwd, argv: ["node", "prodo", "init", ".", "--lang", "tr"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  const settings = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "settings.json"), "utf8"));
  assert.equal(settings.lang, "tr");
});

test("init with --author stores author setting", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "init", ".", "--author", "Shahmarasy"],
    log: () => {},
    error: () => {}
  });
  assert.equal(code, 0);
  const settings = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "settings.json"), "utf8"));
  assert.equal(settings.author, "Shahmarasy");
});

test("init aligns schema required headings with scaffold templates", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await fs.mkdir(path.join(cwd, "templates", "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "templates", "artifacts", "prd.md"),
    "# PRD Template\n\n## Section A\n- A\n\n## Section B\n- B\n",
    "utf8"
  );
  const code = await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  const schemaRaw = await fs.readFile(path.join(cwd, ".prodo", "schemas", "prd.yaml"), "utf8");
  assert.match(schemaRaw, /x_required_headings:/);
  assert.match(schemaRaw, /## Section A/);
  assert.match(schemaRaw, /## Section B/);
});

