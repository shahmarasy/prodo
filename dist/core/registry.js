"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRegistry = readRegistry;
exports.syncRegistry = syncRegistry;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const paths_1 = require("./paths");
const utils_1 = require("./utils");
const EMPTY_REGISTRY = {
    schema_version: "1.0",
    updated_at: new Date(0).toISOString(),
    installed_presets: [],
    installed_overrides: []
};
async function sha256(filePath) {
    const raw = await promises_1.default.readFile(filePath);
    return (0, node_crypto_1.createHash)("sha256").update(raw).digest("hex");
}
function sanitizeRegistry(input) {
    if (!input || typeof input !== "object")
        return { ...EMPTY_REGISTRY };
    const raw = input;
    const installedPresets = Array.isArray(raw.installed_presets)
        ? raw.installed_presets
            .filter((value) => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [];
    const installedOverrides = Array.isArray(raw.installed_overrides)
        ? raw.installed_overrides
            .filter((item) => !!item && typeof item === "object")
            .map((item) => ({
            artifact_type: typeof item.artifact_type === "string" ? item.artifact_type.trim() : "",
            file: typeof item.file === "string" ? item.file.trim() : "",
            sha256: typeof item.sha256 === "string" ? item.sha256.trim() : ""
        }))
            .filter((item) => item.artifact_type && item.file && item.sha256)
        : [];
    return {
        schema_version: "1.0",
        updated_at: typeof raw.updated_at === "string" && raw.updated_at.trim() ? raw.updated_at : EMPTY_REGISTRY.updated_at,
        installed_presets: Array.from(new Set(installedPresets)),
        installed_overrides: installedOverrides
    };
}
async function readRegistry(cwd) {
    const file = (0, paths_1.registryPath)(cwd);
    if (!(await (0, utils_1.fileExists)(file)))
        return { ...EMPTY_REGISTRY };
    try {
        const parsed = JSON.parse(await promises_1.default.readFile(file, "utf8"));
        return sanitizeRegistry(parsed);
    }
    catch {
        return { ...EMPTY_REGISTRY };
    }
}
async function readInstalledPresetsFromFile(cwd) {
    const file = node_path_1.default.join(cwd, ".prodo", "presets", "installed.json");
    if (!(await (0, utils_1.fileExists)(file)))
        return [];
    try {
        const parsed = JSON.parse(await promises_1.default.readFile(file, "utf8"));
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((value) => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }
    catch {
        return [];
    }
}
async function discoverOverrides(cwd) {
    const overridesDir = node_path_1.default.join(cwd, ".prodo", "templates", "overrides");
    if (!(await (0, utils_1.fileExists)(overridesDir)))
        return [];
    const entries = await promises_1.default.readdir(overridesDir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        if (!entry.name.endsWith(".md"))
            continue;
        const fullPath = node_path_1.default.join(overridesDir, entry.name);
        out.push({
            artifact_type: entry.name.replace(/\.md$/, ""),
            file: fullPath,
            sha256: await sha256(fullPath)
        });
    }
    out.sort((a, b) => a.artifact_type.localeCompare(b.artifact_type));
    return out;
}
async function syncRegistry(cwd) {
    const existing = await readRegistry(cwd);
    const discoveredPresets = await readInstalledPresetsFromFile(cwd);
    const discoveredOverrides = await discoverOverrides(cwd);
    const mergedPresets = Array.from(new Set([...existing.installed_presets, ...discoveredPresets])).sort();
    const merged = {
        schema_version: "1.0",
        updated_at: new Date().toISOString(),
        installed_presets: mergedPresets,
        installed_overrides: discoveredOverrides
    };
    const file = (0, paths_1.registryPath)(cwd);
    await (0, utils_1.ensureDir)(node_path_1.default.dirname(file));
    await promises_1.default.writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
}
