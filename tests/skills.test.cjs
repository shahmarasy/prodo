"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { makeTempDir } = require("./helpers.cjs");
const { runCli } = require("../dist/cli/index");

const { createSkillEngine, getGlobalSkillEngine, resetGlobalSkillEngine } = require("../dist/skills/engine");

test("skill engine registers and lists skills", () => {
  const engine = createSkillEngine();
  assert.equal(engine.listSkills().length, 0);

  engine.register({
    manifest: { name: "test-skill", description: "A test skill", category: "custom", inputs: [], outputs: [] },
    execute: async () => ({})
  });

  assert.equal(engine.listSkills().length, 1);
  assert.equal(engine.listSkills()[0].name, "test-skill");
});

test("skill engine getSkill returns registered skill", () => {
  const engine = createSkillEngine();
  const skill = {
    manifest: { name: "find-me", description: "Test", category: "custom", inputs: [], outputs: [] },
    execute: async () => ({ found: true })
  };
  engine.register(skill);
  assert.ok(engine.getSkill("find-me"));
  assert.equal(engine.getSkill("nonexistent"), undefined);
});

test("skill engine validates required inputs", async () => {
  const engine = createSkillEngine();
  engine.register({
    manifest: {
      name: "strict-skill",
      description: "Needs inputs",
      category: "custom",
      inputs: [{ name: "cwd", type: "path", required: true, description: "Working dir" }],
      outputs: []
    },
    execute: async () => ({})
  });

  await assert.rejects(
    () => engine.execute("strict-skill", { cwd: "/tmp", log: () => {} }, {}),
    (err) => {
      assert.ok(err.message.includes("requires input"));
      assert.ok(err.message.includes("cwd"));
      return true;
    }
  );
});

test("skill engine rejects unknown skill", async () => {
  const engine = createSkillEngine();
  await assert.rejects(
    () => engine.execute("nonexistent", { cwd: "/tmp", log: () => {} }, {}),
    (err) => {
      assert.ok(err.message.includes("Unknown skill"));
      return true;
    }
  );
});

test("global skill engine loads builtin skills", () => {
  resetGlobalSkillEngine();
  const engine = getGlobalSkillEngine();
  const skills = engine.listSkills();
  const names = skills.map((s) => s.name).sort();
  assert.ok(names.includes("normalize"), "should have normalize skill");
  assert.ok(names.includes("validate"), "should have validate skill");
  assert.ok(names.includes("fix"), "should have fix skill");
  assert.ok(names.includes("generate-artifact"), "should have generate-artifact skill");
  assert.ok(names.includes("generate-pipeline"), "should have generate-pipeline skill");
});

test("normalize skill executes successfully", async () => {
  const cwd = await makeTempDir();
  const t = { after: (fn) => process.on("exit", fn) };
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  const engine = getGlobalSkillEngine();
  const result = await engine.execute("normalize", { cwd, log: () => {} }, { cwd });
  assert.ok(result.normalizedBriefPath);
  const exists = await fs.stat(result.normalizedBriefPath).then(() => true).catch(() => false);
  assert.ok(exists, "normalized brief should exist after skill execution");

  await fs.rm(cwd, { recursive: true, force: true });
});

test("prodo skills list shows available skills", async () => {
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
  assert.ok(output.includes("validate"), "should list validate skill");

  await fs.rm(cwd, { recursive: true, force: true });
});
