"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { renderTemplate } = require("../dist/core/template-engine");

test("renderTemplate replaces simple variables", () => {
  const result = renderTemplate("Hello {{ name }}!", { name: "World" });
  assert.equal(result, "Hello World!");
});

test("renderTemplate handles missing variables gracefully", () => {
  const result = renderTemplate("Hello {{ name }}!", {});
  assert.equal(result, "Hello !");
});

test("renderTemplate supports if conditionals", () => {
  const template = "{% if show %}Visible{% endif %}";
  assert.equal(renderTemplate(template, { show: true }), "Visible");
  assert.equal(renderTemplate(template, { show: false }), "");
});

test("renderTemplate supports for loops", () => {
  const template = "{% for item in items %}- {{ item }}\n{% endfor %}";
  const result = renderTemplate(template, { items: ["A", "B", "C"] });
  assert.ok(result.includes("- A"));
  assert.ok(result.includes("- B"));
  assert.ok(result.includes("- C"));
});

test("slug filter works correctly", () => {
  const result = renderTemplate("{{ title | slug }}", { title: "My Product Name" });
  assert.equal(result, "my-product-name");
});

test("bold filter wraps in markdown bold", () => {
  const result = renderTemplate("{{ text | bold }}", { text: "important" });
  assert.equal(result, "**important**");
});

test("upper filter uppercases text", () => {
  const result = renderTemplate("{{ text | upper }}", { text: "hello" });
  assert.equal(result, "HELLO");
});

test("dateFormat filter formats dates", () => {
  const result = renderTemplate("{{ date | dateFormat }}", { date: "2026-03-25T00:00:00Z" });
  assert.equal(result, "2026-03-25");
});

test("renderTemplate preserves markdown content", () => {
  const template = `# {{ title }}

## Goals
{% for goal in goals %}- {{ goal }}
{% endfor %}
## Notes
{{ notes }}`;

  const result = renderTemplate(template, {
    title: "My PRD",
    goals: ["G1: Launch MVP", "G2: Onboard 100 users"],
    notes: "This is a draft."
  });

  assert.ok(result.includes("# My PRD"));
  assert.ok(result.includes("- G1: Launch MVP"));
  assert.ok(result.includes("- G2: Onboard 100 users"));
  assert.ok(result.includes("This is a draft."));
});

test("renderTemplate handles nested objects", () => {
  const result = renderTemplate("{{ user.name }} ({{ user.role }})", {
    user: { name: "Alice", role: "PM" }
  });
  assert.equal(result, "Alice (PM)");
});

test("renderTemplate does not autoescape HTML in markdown", () => {
  const result = renderTemplate("{{ html }}", { html: "<strong>bold</strong>" });
  assert.equal(result, "<strong>bold</strong>");
});
