"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSettings = readSettings;
exports.writeSettings = writeSettings;
const promises_1 = __importDefault(require("node:fs/promises"));
const paths_1 = require("./paths");
const utils_1 = require("./utils");
const DEFAULT_SETTINGS = {
    lang: "en"
};
async function readSettings(cwd) {
    const path = (0, paths_1.settingsPath)(cwd);
    if (!(await (0, utils_1.fileExists)(path)))
        return { ...DEFAULT_SETTINGS };
    try {
        const raw = await promises_1.default.readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        return {
            lang: typeof parsed.lang === "string" && parsed.lang.trim() ? parsed.lang.trim() : "en",
            ai: typeof parsed.ai === "string" && parsed.ai.trim() ? parsed.ai.trim() : undefined,
            author: typeof parsed.author === "string" && parsed.author.trim() ? parsed.author.trim() : undefined,
            provider: typeof parsed.provider === "string" && parsed.provider.trim() ? parsed.provider.trim() : undefined
        };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
async function writeSettings(cwd, settings) {
    const path = (0, paths_1.settingsPath)(cwd);
    const clean = { lang: settings.lang };
    if (settings.ai)
        clean.ai = settings.ai;
    if (settings.author)
        clean.author = settings.author;
    if (settings.provider)
        clean.provider = settings.provider;
    await promises_1.default.writeFile(path, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
    return path;
}
