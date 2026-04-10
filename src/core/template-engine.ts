import nunjucks from "nunjucks";

const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: false,
  trimBlocks: false,
  lstripBlocks: false
});

env.addFilter("slug", (value: string): string => {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
});

env.addFilter("bold", (value: string): string => {
  return `**${value ?? ""}**`;
});

env.addFilter("dateFormat", (value: string | Date | undefined): string => {
  if (!value) return new Date().toISOString().split("T")[0];
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().split("T")[0];
});

env.addFilter("upper", (value: string): string => {
  return (value ?? "").toUpperCase();
});

env.addFilter("default", (value: unknown, fallback: string): string => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
});

export function renderTemplate(
  content: string,
  context: Record<string, unknown>
): string {
  return env.renderString(content, context);
}

export function getTemplateEnv(): nunjucks.Environment {
  return env;
}
