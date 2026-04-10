"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOutputIndex = loadOutputIndex;
exports.saveOutputIndex = saveOutputIndex;
exports.setActiveArtifact = setActiveArtifact;
exports.getActiveArtifactPath = getActiveArtifactPath;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const utils_1 = require("./utils");
function defaultIndex() {
    return {
        active: {},
        history: {},
        updated_at: new Date(0).toISOString()
    };
}
async function loadOutputIndex(cwd) {
    const indexPath = (0, paths_1.outputIndexPath)(cwd);
    if (!(await (0, utils_1.fileExists)(indexPath)))
        return defaultIndex();
    const raw = await promises_1.default.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
        active: parsed.active ?? {},
        history: parsed.history ?? {},
        updated_at: parsed.updated_at ?? new Date(0).toISOString()
    };
}
async function saveOutputIndex(cwd, index) {
    const indexPath = (0, paths_1.outputIndexPath)(cwd);
    await (0, utils_1.ensureDir)(node_path_1.default.dirname(indexPath));
    await promises_1.default.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}
async function setActiveArtifact(cwd, type, filePath) {
    const index = await loadOutputIndex(cwd);
    const normalizedPath = node_path_1.default.resolve(filePath);
    const existing = index.history[type] ?? [];
    index.active[type] = normalizedPath;
    index.history[type] = [normalizedPath, ...existing.filter((item) => item !== normalizedPath)].slice(0, 100);
    index.updated_at = new Date().toISOString();
    await saveOutputIndex(cwd, index);
}
async function getActiveArtifactPath(cwd, type) {
    const index = await loadOutputIndex(cwd);
    const candidate = index.active[type];
    if (!candidate)
        return undefined;
    if (await (0, utils_1.fileExists)(candidate))
        return candidate;
    return undefined;
}
