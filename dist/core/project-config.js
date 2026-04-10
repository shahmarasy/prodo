"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProjectConfig = readProjectConfig;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("./errors");
const utils_1 = require("./utils");
function sanitizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
function sanitizeArtifact(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const rec = raw;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name)
        return null;
    const outputDir = typeof rec.output_dir === "string" ? rec.output_dir.trim() : undefined;
    const requiredHeadings = sanitizeStringArray(rec.required_headings);
    const upstream = sanitizeStringArray(rec.upstream);
    const requiredContracts = sanitizeStringArray(rec.required_contracts)
        .filter((value) => value === "goals" || value === "core_features" || value === "constraints");
    return {
        name,
        ...(outputDir ? { output_dir: outputDir } : {}),
        ...(requiredHeadings.length > 0 ? { required_headings: requiredHeadings } : {}),
        ...(upstream.length > 0 ? { upstream } : {}),
        ...(requiredContracts.length > 0 ? { required_contracts: requiredContracts } : {})
    };
}
function sanitizeConfig(raw) {
    if (!raw || typeof raw !== "object")
        return {};
    const rec = raw;
    const artifacts = Array.isArray(rec.artifacts)
        ? rec.artifacts.map(sanitizeArtifact).filter((item) => item !== null)
        : [];
    return {
        presets: sanitizeStringArray(rec.presets),
        command_packs: sanitizeStringArray(rec.command_packs),
        ...(artifacts.length > 0 ? { artifacts } : {})
    };
}
async function readProjectConfig(cwd) {
    const candidates = [
        node_path_1.default.join(cwd, ".prodo", "config.json"),
        node_path_1.default.join(cwd, "prodo.config.json")
    ];
    for (const candidate of candidates) {
        if (!(await (0, utils_1.fileExists)(candidate)))
            continue;
        try {
            const parsed = JSON.parse(await promises_1.default.readFile(candidate, "utf8"));
            return sanitizeConfig(parsed);
        }
        catch {
            throw new errors_1.UserError(`Invalid project config JSON: ${candidate}`);
        }
    }
    return {};
}
