"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runClean = runClean;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const utils_1 = require("./utils");
const REMOVABLE_DIRS = [
    "product-docs"
];
const REMOVABLE_PRODO_SUBDIRS = [
    "state",
    "briefs"
];
const PRESERVED_PRODO_FILES = [
    "settings.json",
    "hooks.yml",
    "config.json"
];
async function runClean(options) {
    const { cwd, dryRun = false, log = console.log } = options;
    const result = { removedPaths: [], preservedPaths: [] };
    for (const dir of REMOVABLE_DIRS) {
        const fullPath = node_path_1.default.join(cwd, dir);
        if (await (0, utils_1.fileExists)(fullPath)) {
            if (dryRun) {
                log(`[Dry Run] Would remove: ${fullPath}`);
            }
            else {
                await promises_1.default.rm(fullPath, { recursive: true, force: true });
                log(`Removed: ${fullPath}`);
            }
            result.removedPaths.push(fullPath);
        }
    }
    const prodo = (0, paths_1.prodoPath)(cwd);
    for (const subdir of REMOVABLE_PRODO_SUBDIRS) {
        const fullPath = node_path_1.default.join(prodo, subdir);
        if (await (0, utils_1.fileExists)(fullPath)) {
            if (dryRun) {
                log(`[Dry Run] Would remove: ${fullPath}`);
            }
            else {
                await promises_1.default.rm(fullPath, { recursive: true, force: true });
                log(`Removed: ${fullPath}`);
            }
            result.removedPaths.push(fullPath);
        }
    }
    const briefPath = node_path_1.default.join(cwd, "brief.md");
    if (await (0, utils_1.fileExists)(briefPath)) {
        result.preservedPaths.push(briefPath);
    }
    for (const file of PRESERVED_PRODO_FILES) {
        const fullPath = node_path_1.default.join(prodo, file);
        if (await (0, utils_1.fileExists)(fullPath)) {
            result.preservedPaths.push(fullPath);
        }
    }
    const preservedDirs = ["templates", "schemas", "prompts", "commands", "presets"];
    for (const dir of preservedDirs) {
        const fullPath = node_path_1.default.join(prodo, dir);
        if (await (0, utils_1.fileExists)(fullPath)) {
            result.preservedPaths.push(fullPath);
        }
    }
    if (result.preservedPaths.length > 0 && !dryRun) {
        log(`Preserved: ${result.preservedPaths.length} file(s)/dir(s)`);
    }
    return result;
}
