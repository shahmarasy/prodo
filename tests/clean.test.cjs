"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { makeTempDir } = require("./helpers.cjs");
const { runCli } = require("../dist/cli/index");

test("clean removes product-docs and state", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await runCli({ cwd, argv: ["node", "prodo", "generate"], log: () => {}, error: () => {} });

  const productDocsBefore = await fs.stat(path.join(cwd, "product-docs")).then(() => true).catch(() => false);
  assert.ok(productDocsBefore, "product-docs should exist before clean");

  await runCli({ cwd, argv: ["node", "prodo", "clean"], log: () => {}, error: () => {} });

  const productDocsAfter = await fs.stat(path.join(cwd, "product-docs")).then(() => true).catch(() => false);
  assert.equal(productDocsAfter, false, "product-docs should be removed after clean");
});

test("clean preserves brief.md and settings", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await runCli({ cwd, argv: ["node", "prodo", "generate"], log: () => {}, error: () => {} });

  await runCli({ cwd, argv: ["node", "prodo", "clean"], log: () => {}, error: () => {} });

  const briefExists = await fs.stat(path.join(cwd, "brief.md")).then(() => true).catch(() => false);
  assert.ok(briefExists, "brief.md should be preserved");

  const settingsExists = await fs.stat(path.join(cwd, ".prodo", "settings.json")).then(() => true).catch(() => false);
  assert.ok(settingsExists, "settings.json should be preserved");

  const templatesExist = await fs.stat(path.join(cwd, ".prodo", "templates")).then(() => true).catch(() => false);
  assert.ok(templatesExist, "templates directory should be preserved");
});

test("clean --dry-run lists without deleting", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));

  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });
  await runCli({ cwd, argv: ["node", "prodo", "generate"], log: () => {}, error: () => {} });

  const logs = [];
  await runCli({ cwd, argv: ["node", "prodo", "clean", "--dry-run"], log: (m) => logs.push(m), error: () => {} });

  const output = logs.join("\n");
  assert.ok(output.includes("[Dry Run]"), "should mention dry run");

  const productDocsAfter = await fs.stat(path.join(cwd, "product-docs")).then(() => true).catch(() => false);
  assert.ok(productDocsAfter, "product-docs should still exist after dry-run");
});
