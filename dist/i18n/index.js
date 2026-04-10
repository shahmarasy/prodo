"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.t = t;
exports.loadTranslations = loadTranslations;
exports.availableLanguages = availableLanguages;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const cache = new Map();
function loadJson(lang) {
    if (cache.has(lang))
        return cache.get(lang);
    const filePath = node_path_1.default.resolve(__dirname, `${lang}.json`);
    try {
        const raw = node_fs_1.default.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        cache.set(lang, parsed);
        return parsed;
    }
    catch {
        cache.set(lang, {});
        return {};
    }
}
function normalizeLang(lang) {
    if (!lang)
        return "en";
    const code = lang.toLowerCase().trim();
    if (code.startsWith("tr"))
        return "tr";
    if (code.startsWith("en"))
        return "en";
    return code;
}
function t(key, lang) {
    const normalized = normalizeLang(lang);
    const translations = loadJson(normalized);
    if (key in translations)
        return translations[key];
    if (normalized !== "en") {
        const fallback = loadJson("en");
        if (key in fallback)
            return fallback[key];
    }
    return key;
}
function loadTranslations(lang) {
    return { ...loadJson(normalizeLang(lang)) };
}
function availableLanguages() {
    const dir = node_path_1.default.resolve(__dirname);
    try {
        return node_fs_1.default.readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(".json", ""))
            .sort();
    }
    catch {
        return ["en"];
    }
}
