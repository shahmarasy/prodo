"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplate = resolveTemplate;
exports.resolveCompanionTemplate = resolveCompanionTemplate;
exports.extractRequiredHeadingsFromTemplate = extractRequiredHeadingsFromTemplate;
const promises_1 = __importDefault(require("node:fs/promises"));
const paths_1 = require("./paths");
const markdown_1 = require("./markdown");
const utils_1 = require("./utils");
async function resolveTemplate(options) {
    const { cwd, artifactType } = options;
    const candidates = [
        ...(0, paths_1.overrideTemplateCandidatePaths)(cwd, artifactType),
        ...(0, paths_1.templateCandidatePaths)(cwd, artifactType)
    ];
    for (const filePath of candidates) {
        if (await (0, utils_1.fileExists)(filePath)) {
            const content = await promises_1.default.readFile(filePath, "utf8");
            return { path: filePath, content };
        }
    }
    return null;
}
async function resolveCompanionTemplate(options) {
    const { cwd, artifactType } = options;
    const nativeExt = artifactType === "workflow" ? ".mmd" : artifactType === "wireframe" ? ".html" : null;
    if (!nativeExt)
        return null;
    const candidates = [
        ...(0, paths_1.overrideTemplateCandidatePaths)(cwd, artifactType),
        ...(0, paths_1.templateCandidatePaths)(cwd, artifactType)
    ].filter((candidate) => candidate.toLowerCase().endsWith(nativeExt));
    for (const filePath of candidates) {
        if (await (0, utils_1.fileExists)(filePath)) {
            const content = await promises_1.default.readFile(filePath, "utf8");
            return { path: filePath, content };
        }
    }
    return null;
}
function extractRequiredHeadingsFromTemplate(content) {
    return (0, markdown_1.extractRequiredHeadings)(content);
}
