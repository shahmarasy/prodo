"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prodoPath = prodoPath;
exports.briefPath = briefPath;
exports.normalizedBriefPath = normalizedBriefPath;
exports.settingsPath = settingsPath;
exports.registryPath = registryPath;
exports.promptPath = promptPath;
exports.templatePath = templatePath;
exports.overrideTemplatePath = overrideTemplatePath;
exports.templateCandidatePaths = templateCandidatePaths;
exports.overrideTemplateCandidatePaths = overrideTemplateCandidatePaths;
exports.schemaPath = schemaPath;
exports.outputDirPath = outputDirPath;
exports.reportPath = reportPath;
exports.outputIndexPath = outputIndexPath;
exports.outputContextDirPath = outputContextDirPath;
const node_path_1 = __importDefault(require("node:path"));
const constants_1 = require("./constants");
function prodoPath(cwd) {
    return node_path_1.default.join(cwd, constants_1.PRODO_DIR);
}
function briefPath(cwd) {
    return node_path_1.default.join(cwd, "brief.md");
}
function normalizedBriefPath(cwd) {
    return node_path_1.default.join(prodoPath(cwd), "briefs", "normalized-brief.json");
}
function settingsPath(cwd) {
    return node_path_1.default.join(prodoPath(cwd), "settings.json");
}
function registryPath(cwd) {
    return node_path_1.default.join(prodoPath(cwd), "registry.json");
}
function promptPath(cwd, artifactType) {
    return node_path_1.default.join(prodoPath(cwd), "prompts", `${artifactType}.md`);
}
function templatePath(cwd, artifactType) {
    return node_path_1.default.join(prodoPath(cwd), "templates", `${artifactType}.md`);
}
function overrideTemplatePath(cwd, artifactType) {
    return node_path_1.default.join(prodoPath(cwd), "templates", "overrides", `${artifactType}.md`);
}
function templateExtensionsForArtifact(artifactType) {
    if (artifactType === "workflow")
        return ["md", "mmd"];
    if (artifactType === "wireframe")
        return ["md", "html"];
    return ["md"];
}
function templateCandidatePaths(cwd, artifactType) {
    const root = node_path_1.default.join(prodoPath(cwd), "templates");
    return templateExtensionsForArtifact(artifactType).map((ext) => node_path_1.default.join(root, `${artifactType}.${ext}`));
}
function overrideTemplateCandidatePaths(cwd, artifactType) {
    const root = node_path_1.default.join(prodoPath(cwd), "templates", "overrides");
    return templateExtensionsForArtifact(artifactType).map((ext) => node_path_1.default.join(root, `${artifactType}.${ext}`));
}
function schemaPath(cwd, artifactType) {
    return node_path_1.default.join(prodoPath(cwd), "schemas", `${artifactType}.yaml`);
}
function outputDirPath(cwd, artifactType, outputDirOverride) {
    return node_path_1.default.join(cwd, "product-docs", outputDirOverride ?? (0, constants_1.defaultOutputDir)(artifactType));
}
function reportPath(cwd) {
    return node_path_1.default.join(cwd, "product-docs", "reports", "latest-validation.md");
}
function outputIndexPath(cwd) {
    return node_path_1.default.join(prodoPath(cwd), "state", "index.json");
}
function outputContextDirPath(cwd) {
    return node_path_1.default.join(prodoPath(cwd), "state", "context");
}
