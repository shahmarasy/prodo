"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
exports.getTemplateEnv = getTemplateEnv;
const nunjucks_1 = __importDefault(require("nunjucks"));
const env = new nunjucks_1.default.Environment(null, {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: false,
    lstripBlocks: false
});
env.addFilter("slug", (value) => {
    return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item";
});
env.addFilter("bold", (value) => {
    return `**${value ?? ""}**`;
});
env.addFilter("dateFormat", (value) => {
    if (!value)
        return new Date().toISOString().split("T")[0];
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toISOString().split("T")[0];
});
env.addFilter("upper", (value) => {
    return (value ?? "").toUpperCase();
});
env.addFilter("default", (value, fallback) => {
    if (value === null || value === undefined || value === "")
        return fallback;
    return String(value);
});
function renderTemplate(content, context) {
    return env.renderString(content, context);
}
function getTemplateEnv() {
    return env;
}
