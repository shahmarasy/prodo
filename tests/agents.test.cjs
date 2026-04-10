"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { getGlobalRegistry, resetGlobalRegistry } = require("../dist/agents/agent-registry");

test("global registry is initialized with all built-in agents", () => {
  resetGlobalRegistry();
  const registry = getGlobalRegistry();
  const agents = registry.list();
  const names = agents.map((a) => a.name).sort();
  assert.deepEqual(names, ["anthropic", "google", "mock", "openai"]);
});

test("mock agent is always available", async () => {
  const registry = getGlobalRegistry();
  const mock = registry.get("mock");
  assert.ok(mock, "mock agent should be registered");
  assert.equal(await mock.isAvailable(), true);
});

test("openai agent is not available without SDK", async () => {
  const registry = getGlobalRegistry();
  const agent = registry.get("openai");
  assert.ok(agent, "openai agent should be registered");
  const available = await agent.isAvailable();
  assert.equal(available, false, "openai should not be available without SDK installed");
});

test("anthropic agent is not available without SDK", async () => {
  const registry = getGlobalRegistry();
  const agent = registry.get("anthropic");
  assert.ok(agent, "anthropic agent should be registered");
  const available = await agent.isAvailable();
  assert.equal(available, false, "anthropic should not be available without SDK installed");
});

test("google agent is not available without SDK", async () => {
  const registry = getGlobalRegistry();
  const agent = registry.get("google");
  assert.ok(agent, "google agent should be registered");
  const available = await agent.isAvailable();
  assert.equal(available, false, "google should not be available without SDK installed");
});

test("registry resolve with unknown agent throws descriptive error", async () => {
  const registry = getGlobalRegistry();
  await assert.rejects(
    () => registry.resolve("nonexistent"),
    (err) => {
      assert.ok(err.message.includes("Unknown agent"));
      assert.ok(err.message.includes("nonexistent"));
      assert.ok(err.message.includes("mock"));
      return true;
    }
  );
});

test("registry aliases resolve correctly", () => {
  const registry = getGlobalRegistry();
  assert.equal(registry.get("claude")?.name, "anthropic");
  assert.equal(registry.get("gemini")?.name, "google");
});

test("mock agent generate produces valid output", async () => {
  const registry = getGlobalRegistry();
  const mock = registry.get("mock");
  const result = await mock.generate(
    "test prompt",
    { briefMarkdown: "# Product Name\nTest\n# Goals\n- Goal 1\n# Features\n- Feature 1" },
    { artifactType: "normalize", requiredHeadings: [], requiredContracts: [] }
  );
  assert.ok(result.body.length > 0, "mock should return non-empty body");
  const parsed = JSON.parse(result.body);
  assert.ok(parsed.product_name !== undefined, "normalize output should have product_name");
});

test("agent getConfig returns expected structure", () => {
  const registry = getGlobalRegistry();
  for (const agent of registry.list()) {
    const config = agent.getConfig();
    assert.ok(config.name, `${agent.name} config should have name`);
    assert.ok(config.displayName, `${agent.name} config should have displayName`);
    assert.ok(Array.isArray(config.envVars), `${agent.name} config should have envVars array`);
  }
});

test("agent availabilityHint provides helpful message", () => {
  const registry = getGlobalRegistry();
  const openai = registry.get("openai");
  const hint = openai.availabilityHint();
  assert.ok(hint.includes("npm install"), "hint should suggest npm install for missing SDK");
  assert.ok(hint.includes("OPENAI_API_KEY"), "hint should mention required env var");
});
