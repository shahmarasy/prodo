const test = require("node:test");
const assert = require("node:assert/strict");
const { runCli } = require("../dist/cli");
const { fs, path, makeTempDir } = require("./helpers.cjs");

test("artifact generation fails when prereq missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "prd"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Missing \.prodo directory/);
});

test("normalize command writes normalized brief", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, "brief.md"),
    "# Start Brief\n\n## Product Name\nPhoto Hub\n\n## Problem\nUsers cannot organize photos quickly.\n\n## Audience\n- Photographer\n\n## Goals\n- Improve organization speed\n\n## Core Features\n- Album management\n- Drag and drop sorting\n",
    "utf8"
  );

  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  const normalized = JSON.parse(await fs.readFile(path.join(cwd, ".prodo", "briefs", "normalized-brief.json"), "utf8"));
  assert.equal(normalized.product_name, "Photo Hub");
  assert.ok(Array.isArray(normalized.contracts.goals));
});

test("normalize supports flexible headings and heading levels", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(
    path.join(cwd, "brief.md"),
    "# Start Brief\n\n### Name\nFlow Desk\n\n### Problem Statement\nTeams lose context in handoffs.\n\n### Users\n- PM\n- Engineer\n\n### Features\n- Workflow board\n- Handoff checks\n\n### Objectives\n- Reduce handoff errors\n",
    "utf8"
  );
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: () => {}, error: () => {} });
  assert.equal(code, 0);
});

test("normalize fails loudly when critical fields are missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(path.join(cwd, "brief.md"), "# Start Brief\n\n## Product Name\nFlow Desk\n\n## Audience\n- PM\n", "utf8");
  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Normalized brief is invalid|Normalization confidence too low/i);
});

test("normalize --out fails outside .prodo", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const outPath = path.join(cwd, "product-docs", "normalized.json");
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize", "--out", outPath], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Normalize output must be inside `\.prodo\/`/i);
});

test("generate and validate happy path", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "prd"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  const validateCode = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(validateCode, 0);
});

test("generate runs normalize + artifact pipeline + validate", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const code = await runCli({ cwd, argv: ["node", "prodo", "generate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  await fs.stat(path.join(cwd, ".prodo", "briefs", "normalized-brief.json"));
  await fs.stat(path.join(cwd, "product-docs", "prd"));
  await fs.stat(path.join(cwd, "product-docs", "workflows"));
  await fs.stat(path.join(cwd, "product-docs", "wireframes"));
  await fs.stat(path.join(cwd, "product-docs", "stories"));
  await fs.stat(path.join(cwd, "product-docs", "techspec"));
  assert.match(logs.join("\n"), /Generation pipeline completed\. Validation passed\./);
});

test("validate fails on negated contract intent", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await runCli({ cwd, argv: ["node", "prodo", "prd"], log: () => {}, error: () => {} });
  const prdDir = path.join(cwd, "product-docs", "prd");
  const prdPath = path.join(prdDir, (await fs.readdir(prdDir))[0]);
  await fs.writeFile(prdPath, (await fs.readFile(prdPath, "utf8")).replace(/\[G1\][^\n]*/g, "[G1] Uses blockchain mining for avatars."), "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
});

test("validate fails on semantic contradiction between workflow and techspec", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const normalizedPath = path.join(cwd, ".prodo", "briefs", "normalized-brief.json");
  const normalized = JSON.parse(await fs.readFile(normalizedPath, "utf8"));
  normalized.core_features = ["Guest checkout"];
  normalized.goals = ["Reduce checkout friction"];
  normalized.constraints = ["PCI compliance"];
  normalized.contracts = { goals: [{ id: "G1", text: "Reduce checkout friction" }], core_features: [{ id: "F1", text: "Guest checkout" }], constraints: [{ id: "C1", text: "PCI compliance" }] };
  await fs.writeFile(normalizedPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: () => {}, error: () => {} });
  await runCli({ cwd, argv: ["node", "prodo", "techspec"], log: () => {}, error: () => {} });
  const workflowDir = path.join(cwd, "product-docs", "workflows");
  const techspecDir = path.join(cwd, "product-docs", "techspec");
  const workflowPath = path.join(workflowDir, (await fs.readdir(workflowDir))[0]);
  const techspecPath = path.join(techspecDir, (await fs.readdir(techspecDir))[0]);
  await fs.writeFile(workflowPath, (await fs.readFile(workflowPath, "utf8")).replace(/\[F1\][^\n]*/g, "[F1] Guest checkout enabled."), "utf8");
  await fs.writeFile(techspecPath, (await fs.readFile(techspecPath, "utf8")).replace(/\[F1\][^\n]*/g, "[F1] Auth required for checkout."), "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
});

test("agent command set and agent-based generation", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "agent-commands", "--agent", "codex"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "prd", "--agent", "codex"], log: (m) => logs.push(m), error: (m) => logs.push(m) }), 0);
  assert.match(logs.join("\n"), /Recommended sequence/);
});

test("template override is used in generation", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(path.join(cwd, ".prodo", "templates", "overrides", "prd.md"), "# PRD Template\n\n## North Star\n- Track a single north-star metric.\n\n## Scope\n- Include only MVP scope.\n", "utf8");
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "prd"], log: () => {}, error: () => {} }), 0);
  const prdDir = path.join(cwd, "product-docs", "prd");
  const content = await fs.readFile(path.join(prdDir, (await fs.readdir(prdDir))[0]), "utf8");
  assert.match(content, /## North Star/);
});

test("prd generation fails when prd template is missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.rm(path.join(cwd, ".prodo", "templates", "prd.md"), { force: true });
  const code = await runCli({ cwd, argv: ["node", "prodo", "prd"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Missing PRD template/i);
});

test("prd generation fails when template has no headings", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(path.join(cwd, ".prodo", "templates", "prd.md"), "just text with no headings", "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "prd"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /no extractable headings/i);
});

test("stories generation fails when stories template is missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.rm(path.join(cwd, ".prodo", "templates", "stories.md"), { force: true });
  const code = await runCli({ cwd, argv: ["node", "prodo", "stories"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Missing stories template/i);
});

test("workflow generation fails when workflow template has no headings", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(path.join(cwd, ".prodo", "templates", "overrides", "workflow.md"), "plain text no headings", "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /workflow template has no extractable headings/i);
});

test("workflow generation fails when workflow companion template is missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.rm(path.join(cwd, ".prodo", "templates", "workflow.mmd"), { force: true });
  const code = await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Missing workflow companion template/i);
});

test("workflow derived context survives renamed template headings", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(path.join(cwd, ".prodo", "templates", "overrides", "workflow.md"), "# Workflow Template\n\n## Primary Actors\n- Customer\n\n## Happy Path\n1. User starts checkout\n2. System processes\n\n## Failure Paths\n- Payment failure fallback\n", "utf8");
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: () => {}, error: () => {} }), 0);
  const workflowDir = path.join(cwd, "product-docs", "workflows");
  const workflowFile = (await fs.readdir(workflowDir)).find((name) => name.endsWith(".md"));
  assert.ok(workflowFile);
  const contextPath = path.join(cwd, ".prodo", "state", "context", `${path.parse(workflowFile).name}.json`);
  const context = JSON.parse(await fs.readFile(contextPath, "utf8"));
  assert.ok(Array.isArray(context.contract_coverage.core_features));
  assert.ok(context.contract_coverage.core_features.length > 0);
});

test("workflow output is paired markdown + mermaid", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: () => {}, error: () => {} }), 0);
  const workflowDir = path.join(cwd, "product-docs", "workflows");
  const mdFile = (await fs.readdir(workflowDir)).find((name) => name.endsWith(".md"));
  assert.ok(mdFile);
  const mmdFile = `${path.parse(mdFile).name}.mmd`;
  await fs.stat(path.join(workflowDir, mmdFile));
  const content = await fs.readFile(path.join(workflowDir, mmdFile), "utf8");
  assert.match(content, /flowchart\s+TD/i);
});

test("workflow --out .md generates paired .md and .mmd files", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const outPath = path.join(cwd, "product-docs", "workflows", "manual-workflow.md");
  const code = await runCli({ cwd, argv: ["node", "prodo", "workflow", "--out", outPath], log: () => {}, error: () => {} });
  assert.equal(code, 0);
  await fs.stat(outPath);
  await fs.stat(path.join(cwd, "product-docs", "workflows", "manual-workflow.mmd"));
});

test("artifact --out fails outside product-docs", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const outPath = path.join(cwd, "tmp-prd.md");
  const code = await runCli({ cwd, argv: ["node", "prodo", "prd", "--out", outPath], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Artifact output must be inside `product-docs\/`/i);
});

test("wireframe output is paired markdown + html screens", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "wireframe"], log: () => {}, error: () => {} }), 0);
  const wireframeDir = path.join(cwd, "product-docs", "wireframes");
  const mdFiles = (await fs.readdir(wireframeDir)).filter((name) => name.endsWith(".md"));
  const htmlFiles = (await fs.readdir(wireframeDir)).filter((name) => name.endsWith(".html"));
  assert.ok(mdFiles.length >= 1);
  assert.ok(htmlFiles.length >= 2);
  const firstMdBase = path.parse(mdFiles[0]).name;
  assert.ok(htmlFiles.includes(`${firstMdBase}.html`));
});

test("wireframe html output follows wireframe.html template", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.writeFile(
    path.join(cwd, ".prodo", "templates", "wireframe.html"),
    "<!doctype html><html><body><main>CUSTOM-WIREFRAME {{Screen Title}}</main></body></html>\n",
    "utf8"
  );
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "wireframe"], log: () => {}, error: () => {} }), 0);
  const wireframeDir = path.join(cwd, "product-docs", "wireframes");
  const htmlFile = (await fs.readdir(wireframeDir)).find((name) => name.endsWith(".html"));
  assert.ok(htmlFile);
  const html = await fs.readFile(path.join(wireframeDir, htmlFile), "utf8");
  assert.match(html, /CUSTOM-WIREFRAME/i);
});

test("wireframe generation fails when wireframe companion template is missing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await fs.rm(path.join(cwd, ".prodo", "templates", "wireframe.html"), { force: true });
  const code = await runCli({ cwd, argv: ["node", "prodo", "wireframe"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Missing wireframe companion template/i);
});

test("validate fails on mixed language when project language is Turkish", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init", ".", "--lang", "tr"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "prd"], log: () => {}, error: () => {} }), 0);
  const prdDir = path.join(cwd, "product-docs", "prd");
  const prdFile = (await fs.readdir(prdDir)).find((name) => name.endsWith(".md"));
  assert.ok(prdFile);
  const prdPath = path.join(prdDir, prdFile);
  await fs.writeFile(prdPath, `${await fs.readFile(prdPath, "utf8")}\n\nThe user should proceed with the flow.\n`, "utf8");
  const sidecarPath = path.join(prdDir, `${path.parse(prdFile).name}.artifact.json`);
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, "utf8"));
  sidecar.body = `${sidecar.body}\nThe user should proceed with the flow.\n`;
  await fs.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
});

test("validate fails when workflow artifact is prose instead of mermaid", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "workflow"], log: () => {}, error: () => {} }), 0);
  const workflowDir = path.join(cwd, "product-docs", "workflows");
  const mdFile = (await fs.readdir(workflowDir)).find((name) => name.endsWith(".md"));
  assert.ok(mdFile);
  const mmdPath = path.join(workflowDir, `${path.parse(mdFile).name}.mmd`);
  const sidecarPath = path.join(workflowDir, `${path.parse(mdFile).name}.artifact.json`);
  await fs.writeFile(mmdPath, "## Actors\n- User\n## Main Flow\n- step\n", "utf8");
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, "utf8"));
  sidecar.body = "## Flow Purpose\n- valid\n## Actors\n- User\n## Preconditions\n- ok\n## Main Flow\n- step\n## Edge Cases\n- err\n## Postconditions\n- done\n";
  await fs.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
});

test("validate fails when wireframe entry is plain text instead of html", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  assert.equal(await runCli({ cwd, argv: ["node", "prodo", "wireframe"], log: () => {}, error: () => {} }), 0);
  const wireframeDir = path.join(cwd, "product-docs", "wireframes");
  const mdFile = (await fs.readdir(wireframeDir)).find((name) => name.endsWith(".md"));
  assert.ok(mdFile);
  const htmlPath = path.join(wireframeDir, `${path.parse(mdFile).name}.html`);
  await fs.writeFile(htmlPath, "## Wireframe Notes\n- text only\n", "utf8");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
});

test("doctor command prints grouped environment report", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "doctor"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  const out = logs.join("\n");
  assert.match(out, /Checking environment\.\.\./);
  assert.match(out, /Core/);
  assert.match(out, /AI \/ Agents/);
  assert.match(out, /Dev Tools/);
});

test("cli help emphasizes only primary commands", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "--help"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  const out = logs.join("\n");
  assert.match(out, /init/);
  assert.match(out, /generate/);
  assert.match(out, /doctor/);
  assert.doesNotMatch(out, /\bprd\b/);
  assert.doesNotMatch(out, /\bworkflow\b/);
  assert.doesNotMatch(out, /\bwireframe\b/);
  assert.doesNotMatch(out, /\bstories\b/);
  assert.doesNotMatch(out, /\btechspec\b/);
});

test("validate --report fails outside product-docs", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  const reportPath = path.join(cwd, ".prodo", "reports", "custom.md");
  const code = await runCli({ cwd, argv: ["node", "prodo", "validate", "--report", reportPath], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /Validation report must be inside `product-docs\/`/i);
});

