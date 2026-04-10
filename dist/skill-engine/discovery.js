"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSkills = discoverSkills;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("../core/paths");
const utils_1 = require("../core/utils");
function isValidManifest(obj) {
    if (!obj || typeof obj !== "object")
        return false;
    const m = obj;
    return (typeof m.name === "string" &&
        typeof m.version === "string" &&
        typeof m.description === "string" &&
        Array.isArray(m.depends_on) &&
        Array.isArray(m.inputs) &&
        Array.isArray(m.outputs));
}
async function discoverSkills(cwd, log) {
    const skillsDir = node_path_1.default.join((0, paths_1.prodoPath)(cwd), "skills");
    if (!(await (0, utils_1.fileExists)(skillsDir)))
        return [];
    const entries = await promises_1.default.readdir(skillsDir);
    const jsFiles = entries.filter((e) => e.endsWith(".js"));
    const skills = [];
    for (const file of jsFiles) {
        const fullPath = node_path_1.default.resolve(skillsDir, file);
        try {
            const mod = require(fullPath);
            const manifest = mod.manifest;
            const execute = mod.execute;
            if (!isValidManifest(manifest)) {
                log?.(`[Skill Discovery] Skipping ${file}: invalid or missing manifest`);
                continue;
            }
            if (typeof execute !== "function") {
                log?.(`[Skill Discovery] Skipping ${file}: missing execute function`);
                continue;
            }
            skills.push({ manifest, execute: execute });
            log?.(`[Skill Discovery] Loaded plugin: ${manifest.name} v${manifest.version}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log?.(`[Skill Discovery] Failed to load ${file}: ${message}`);
        }
    }
    return skills;
}
