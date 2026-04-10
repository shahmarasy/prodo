"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { makeTempDir } = require("./helpers.cjs");
const { runCli } = require("../dist/cli/index");

const { SkillRegistry } = require("../dist/skill-engine/registry");
const { buildExecutionPlan, detectCycles, getExecutionOrder } = require("../dist/skill-engine/graph");
const { validateInputs, validateOutputs } = require("../dist/skill-engine/validator");
const { SkillPipeline } = require("../dist/skill-engine/pipeline");
const { createPipelineState } = require("../dist/skill-engine/context");

// --- Registry Tests ---

test("registry registers and retrieves skills", () => {
  const registry = new SkillRegistry();
  const skill = {
    manifest: { name: "test", version: "1.0.0", description: "Test", category: "custom", depends_on: [], inputs: [], outputs: [] },
    execute: async () => ({})
  };
  registry.register(skill);
  assert.ok(registry.has("test"));
  assert.equal(registry.get("test"), skill);
  assert.equal(registry.size(), 1);
});

test("registry rejects duplicate registration", () => {
  const registry = new SkillRegistry();
  const skill = {
    manifest: { name: "dup", version: "1.0.0", description: "Dup", category: "custom", depends_on: [], inputs: [], outputs: [] },
    execute: async () => ({})
  };
  registry.register(skill);
  assert.throws(() => registry.register(skill), /already registered/);
});

test("registry validates manifest", () => {
  const registry = new SkillRegistry();
  assert.throws(() => registry.register({
    manifest: { name: "", version: "1.0.0", description: "Bad", category: "custom", depends_on: [], inputs: [], outputs: [] },
    execute: async () => ({})
  }), /name is required/);
});

test("registry lists by category", () => {
  const registry = new SkillRegistry();
  registry.register({ manifest: { name: "a", version: "1.0.0", description: "A", category: "core", depends_on: [], inputs: [], outputs: [] }, execute: async () => ({}) });
  registry.register({ manifest: { name: "b", version: "1.0.0", description: "B", category: "custom", depends_on: [], inputs: [], outputs: [] }, execute: async () => ({}) });
  assert.equal(registry.listByCategory("core").length, 1);
  assert.equal(registry.listByCategory("custom").length, 1);
});

test("registry unregisters skills", () => {
  const registry = new SkillRegistry();
  registry.register({ manifest: { name: "rm", version: "1.0.0", description: "RM", category: "custom", depends_on: [], inputs: [], outputs: [] }, execute: async () => ({}) });
  assert.ok(registry.unregister("rm"));
  assert.equal(registry.has("rm"), false);
});

// --- Graph Tests ---

test("topological sort orders dependencies correctly", () => {
  const manifests = new Map([
    ["a", { name: "a", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [], outputs: [] }],
    ["b", { name: "b", version: "1.0.0", description: "", category: "core", depends_on: ["a"], inputs: [], outputs: [] }],
    ["c", { name: "c", version: "1.0.0", description: "", category: "core", depends_on: ["a", "b"], inputs: [], outputs: [] }]
  ]);
  const order = getExecutionOrder(manifests, ["c"]);
  assert.ok(order.indexOf("a") < order.indexOf("b"));
  assert.ok(order.indexOf("b") < order.indexOf("c"));
});

test("cycle detection catches circular dependencies", () => {
  const manifests = new Map([
    ["x", { name: "x", version: "1.0.0", description: "", category: "core", depends_on: ["y"], inputs: [], outputs: [] }],
    ["y", { name: "y", version: "1.0.0", description: "", category: "core", depends_on: ["x"], inputs: [], outputs: [] }]
  ]);
  const cycles = detectCycles(manifests);
  assert.ok(cycles !== null, "should detect cycle");
  assert.ok(cycles.length > 0);
});

test("execution plan groups parallel tiers", () => {
  const manifests = new Map([
    ["root", { name: "root", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [], outputs: [] }],
    ["left", { name: "left", version: "1.0.0", description: "", category: "core", depends_on: ["root"], inputs: [], outputs: [] }],
    ["right", { name: "right", version: "1.0.0", description: "", category: "core", depends_on: ["root"], inputs: [], outputs: [] }],
    ["final", { name: "final", version: "1.0.0", description: "", category: "core", depends_on: ["left", "right"], inputs: [], outputs: [] }]
  ]);
  const tiers = buildExecutionPlan(manifests, ["final"]);
  assert.equal(tiers[0].skills.length, 1); // root
  assert.equal(tiers[1].skills.length, 2); // left + right (parallel)
  assert.equal(tiers[2].skills.length, 1); // final
});

// --- Validator Tests ---

test("validateInputs catches missing required input", () => {
  const manifest = { name: "t", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [{ name: "cwd", type: "path", required: true }], outputs: [] };
  const error = validateInputs(manifest, {});
  assert.ok(error !== null);
  assert.ok(error.message.includes("cwd"));
});

test("validateInputs passes with valid inputs", () => {
  const manifest = { name: "t", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [{ name: "cwd", type: "path", required: true }], outputs: [] };
  const error = validateInputs(manifest, { cwd: "/tmp" });
  assert.equal(error, null);
});

test("validateInputs catches wrong type", () => {
  const manifest = { name: "t", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [{ name: "strict", type: "boolean", required: true }], outputs: [] };
  const error = validateInputs(manifest, { strict: "yes" });
  assert.ok(error !== null);
  assert.ok(error.message.includes("boolean"));
});

test("validateOutputs catches missing output", () => {
  const manifest = { name: "t", version: "1.0.0", description: "", category: "core", depends_on: [], inputs: [], outputs: [{ name: "result", type: "string" }] };
  const error = validateOutputs(manifest, {});
  assert.ok(error !== null);
  assert.ok(error.message.includes("result"));
});

// --- Pipeline Tests ---

test("pipeline runs skills in dependency order with state flow", async () => {
  const registry = new SkillRegistry();
  const executionLog = [];

  registry.register({
    manifest: { name: "step1", version: "1.0.0", description: "Step 1", category: "core", depends_on: [], inputs: [{ name: "cwd", type: "string", required: true }], outputs: [{ name: "normalizedBriefPath", type: "string" }] },
    execute: async (ctx) => { executionLog.push("step1"); return { normalizedBriefPath: "/tmp/brief.json" }; }
  });
  registry.register({
    manifest: { name: "step2", version: "1.0.0", description: "Step 2", category: "core", depends_on: ["step1"], inputs: [{ name: "cwd", type: "string", required: true }], outputs: [{ name: "artifactPath", type: "string" }] },
    execute: async (ctx) => { executionLog.push("step2:" + ctx.state.normalizedBriefPath); return { artifactPath: "/tmp/prd.md" }; }
  });

  const pipeline = new SkillPipeline(registry);
  const state = createPipelineState("/tmp");
  const result = await pipeline.runPipeline(["step2"], state, { log: () => {} });

  assert.deepEqual(executionLog, ["step1", "step2:/tmp/brief.json"]);
  assert.equal(result.normalizedBriefPath, "/tmp/brief.json");
  assert.deepEqual(result.completedSkills, ["step1", "step2"]);
});

test("pipeline skips already completed skills", async () => {
  const registry = new SkillRegistry();
  let count = 0;

  registry.register({
    manifest: { name: "once", version: "1.0.0", description: "Once", category: "core", depends_on: [], inputs: [{ name: "cwd", type: "string", required: true }], outputs: [] },
    execute: async () => { count++; return {}; }
  });

  const pipeline = new SkillPipeline(registry);
  const state = createPipelineState("/tmp");
  state.completedSkills.push("once");
  await pipeline.runPipeline(["once"], state, { log: () => {} });

  assert.equal(count, 0, "should not execute already completed skill");
});

// --- Integration: Engine + CLI ---

test("prodo skills list shows engine-registered skills with deps", async () => {
  const cwd = await makeTempDir();
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  const logs = [];
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "skills", "list"],
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });
  assert.equal(code, 0);
  const output = logs.join("\n");
  assert.ok(output.includes("normalize"), "should list normalize skill");
  assert.ok(output.includes("prd"), "should list prd skill");
  assert.ok(output.includes("validate"), "should list validate skill");
  assert.ok(output.includes("v2.0.0"), "should show version");

  await fs.rm(cwd, { recursive: true, force: true });
});

test("prodo generate uses skill engine pipeline", async () => {
  const cwd = await makeTempDir();
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  const logs = [];
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "generate"],
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });
  assert.equal(code, 0);
  const output = logs.join("\n");
  assert.ok(output.includes("normalize"), "should execute normalize skill");
  assert.ok(output.includes("Validation passed") || output.includes("pipeline completed"), "should complete pipeline");

  await fs.rm(cwd, { recursive: true, force: true });
});

test("custom skill in .prodo/skills/ is discovered and runnable", async () => {
  const cwd = await makeTempDir();
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  const skillsDir = path.join(cwd, ".prodo", "skills");
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, "custom-hello.js"),
    `exports.manifest = {
      name: "custom-hello",
      version: "1.0.0",
      description: "A custom hello skill",
      category: "custom",
      depends_on: [],
      inputs: [{ name: "cwd", type: "string", required: true }],
      outputs: [{ name: "greeting", type: "string" }]
    };
    exports.execute = async (ctx) => {
      ctx.log("Hello from custom skill!");
      return { greeting: "hello" };
    };`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({
    cwd,
    argv: ["node", "prodo", "skills", "list"],
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });
  assert.equal(code, 0);
  assert.ok(logs.join("\n").includes("custom-hello"), "should discover custom skill");

  await fs.rm(cwd, { recursive: true, force: true });
});
