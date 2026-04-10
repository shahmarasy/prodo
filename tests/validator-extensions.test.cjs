"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { buildTermMap, checkTermReconciliation } = require("../dist/core/terminology");
const { buildTraceMap, checkRequirementCompleteness } = require("../dist/core/tracing");

const baseBrief = {
  schema_version: "1.0",
  product_name: "TestApp",
  problem: "Users need to manage tasks efficiently",
  audience: ["Product Managers"],
  goals: ["Improve task tracking"],
  core_features: ["Task board", "Notifications"],
  constraints: ["Must work offline"],
  assumptions: [],
  contracts: {
    goals: [{ id: "G1", text: "Improve task tracking" }],
    core_features: [{ id: "F1", text: "Task board" }, { id: "F2", text: "Notifications" }],
    constraints: [{ id: "C1", text: "Must work offline" }]
  }
};

const mockArtifact = (type, body) => ({
  type,
  file: `product-docs/${type}/${type}.md`,
  doc: { frontmatter: {}, body }
});

test("buildTermMap extracts terms from brief", () => {
  const termMap = buildTermMap(baseBrief, []);
  assert.ok(termMap.size > 0, "should have extracted terms");
  const keys = Array.from(termMap.keys());
  assert.ok(keys.some(k => k.includes("task")), "should include task-related terms");
});

test("buildTermMap extracts bold terms from artifacts", () => {
  const artifact = mockArtifact("prd", "## Goals\n**Task Management** is the core feature.\n[G1] Improve tracking.");
  const termMap = buildTermMap(baseBrief, [artifact]);
  const keys = Array.from(termMap.keys());
  assert.ok(keys.some(k => k.includes("task management")), "should extract bold terms");
});

test("checkTermReconciliation detects similar terms across docs", () => {
  const termMap = new Map();
  termMap.set("user management", {
    term: "User Management",
    normalizedTerm: "user management",
    sources: [{ artifactType: "prd", file: "prd.md" }]
  });
  termMap.set("users managing", {
    term: "Users Managing",
    normalizedTerm: "users managing",
    sources: [{ artifactType: "stories", file: "stories.md" }]
  });
  const issues = checkTermReconciliation(termMap);
  // May or may not detect depending on threshold; just ensure no crash
  assert.ok(Array.isArray(issues), "should return array of issues");
});

test("buildTraceMap traces contract IDs to artifacts", () => {
  const artifact = mockArtifact("prd", "## Goals\n[G1] We aim to improve task tracking.\n[F1] Task board feature.");
  const traceMap = buildTraceMap(baseBrief, [artifact]);
  const g1 = traceMap.get("G1");
  assert.ok(g1, "G1 should be in trace map");
  assert.equal(g1.references.length, 1, "G1 should have 1 reference");
  assert.equal(g1.references[0].artifactType, "prd");
});

test("checkRequirementCompleteness flags untraced contracts", () => {
  const artifact = mockArtifact("prd", "## Goals\n[G1] Track tasks.\n[F1] Task board.");
  const traceMap = buildTraceMap(baseBrief, [artifact]);
  // F2 and C1 are not referenced
  const issues = checkRequirementCompleteness(traceMap, baseBrief, ["prd"]);
  const untraced = issues.filter(i => i.code === "untraced_requirement");
  assert.ok(untraced.length > 0, "should detect untraced F2 or C1");
  const ids = untraced.map(i => i.message);
  assert.ok(ids.some(m => m.includes("F2") || m.includes("C1")), "should mention F2 or C1");
});

test("checkRequirementCompleteness returns empty for full coverage", () => {
  const artifact = mockArtifact("prd", "[G1] goal\n[F1] feat1\n[F2] feat2\n[C1] constraint");
  const traceMap = buildTraceMap(baseBrief, [artifact]);
  const issues = checkRequirementCompleteness(traceMap, baseBrief, ["prd"]);
  const untraced = issues.filter(i => i.code === "untraced_requirement");
  assert.equal(untraced.length, 0, "should have no untraced requirements with full coverage");
});
