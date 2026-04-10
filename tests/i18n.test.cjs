"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { t, loadTranslations, availableLanguages } = require("../dist/i18n/index");

test("t returns English translation for en", () => {
  assert.equal(t("user", "en"), "User");
  assert.equal(t("success", "en"), "Success");
  assert.equal(t("error", "en"), "Error");
});

test("t returns Turkish translation for tr", () => {
  const user = t("user", "tr");
  assert.ok(user.length > 0, "Turkish 'user' should not be empty");
  assert.notEqual(user, "User", "Turkish should differ from English");
});

test("t falls back to English for unknown language", () => {
  assert.equal(t("user", "fr"), "User");
});

test("t falls back to key for nonexistent key", () => {
  assert.equal(t("this_key_does_not_exist", "en"), "this_key_does_not_exist");
});

test("t normalizes language codes", () => {
  assert.equal(t("user", "TR"), t("user", "tr"));
  assert.equal(t("user", "en-US"), t("user", "en"));
  assert.equal(t("user", "tr-TR"), t("user", "tr"));
});

test("t defaults to English when no lang provided", () => {
  assert.equal(t("user"), "User");
});

test("loadTranslations returns full translation map", () => {
  const en = loadTranslations("en");
  assert.ok(Object.keys(en).length > 10, "English should have many keys");
  assert.equal(en.user, "User");
});

test("availableLanguages includes en and tr", () => {
  const langs = availableLanguages();
  assert.ok(langs.includes("en"), "should include en");
  assert.ok(langs.includes("tr"), "should include tr");
});
