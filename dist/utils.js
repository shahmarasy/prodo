"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.fileExists = fileExists;
exports.readJsonFile = readJsonFile;
exports.timestampSlug = timestampSlug;
exports.artifactFileStamp = artifactFileStamp;
exports.listFilesSortedByMtime = listFilesSortedByMtime;
exports.isPathInside = isPathInside;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function ensureDir(dirPath) {
    await promises_1.default.mkdir(dirPath, { recursive: true });
}
async function fileExists(filePath) {
    try {
        await promises_1.default.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
async function readJsonFile(filePath) {
    const raw = await promises_1.default.readFile(filePath, "utf8");
    return JSON.parse(raw);
}
function timestampSlug(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, "-");
}
function pad2(value) {
    return String(value).padStart(2, "0");
}
function artifactFileStamp(date = new Date()) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hour = pad2(date.getHours());
    const minute = pad2(date.getMinutes());
    const second = pad2(date.getSeconds());
    return `${year}${month}${day}-${hour}${minute}${second}`;
}
async function listFilesSortedByMtime(dirPath) {
    const exists = await fileExists(dirPath);
    if (!exists)
        return [];
    const entries = await promises_1.default.readdir(dirPath);
    const withStats = await Promise.all(entries.map(async (name) => {
        const fullPath = node_path_1.default.join(dirPath, name);
        const stat = await promises_1.default.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
    }));
    return withStats
        .filter((entry) => entry.isFile)
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map((entry) => entry.fullPath);
}
function isPathInside(parentDir, candidatePath) {
    const parent = node_path_1.default.resolve(parentDir);
    const child = node_path_1.default.resolve(candidatePath);
    const relative = node_path_1.default.relative(parent, child);
    return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative));
}
