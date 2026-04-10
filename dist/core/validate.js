"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runValidate = runValidate;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const artifact_registry_1 = require("./artifact-registry");
const consistency_1 = require("./consistency");
const errors_1 = require("./errors");
const output_index_1 = require("./output-index");
const paths_1 = require("./paths");
const template_resolver_1 = require("./template-resolver");
const utils_1 = require("./utils");
const validator_1 = require("./validator");
function sidecarPath(filePath) {
    const parsed = node_path_1.default.parse(filePath);
    return node_path_1.default.join(parsed.dir, `${parsed.name}.artifact.json`);
}
async function loadArtifactDoc(filePath) {
    const sidecar = sidecarPath(filePath);
    if (await (0, utils_1.fileExists)(sidecar)) {
        const payload = await (0, utils_1.readJsonFile)(sidecar);
        return {
            frontmatter: payload.frontmatter ?? {},
            body: typeof payload.body === "string" ? payload.body : ""
        };
    }
    const raw = await promises_1.default.readFile(filePath, "utf8");
    const parsed = (0, gray_matter_1.default)(raw);
    return {
        frontmatter: parsed.data,
        body: parsed.content
    };
}
async function loadLatestArtifacts(cwd) {
    const defs = await (0, artifact_registry_1.listArtifactDefinitions)(cwd);
    const loaded = [];
    for (const def of defs) {
        const type = def.name;
        const active = await (0, output_index_1.getActiveArtifactPath)(cwd, type);
        const fallback = async () => {
            const files = await (0, utils_1.listFilesSortedByMtime)((0, paths_1.outputDirPath)(cwd, type, def.output_dir));
            return files[0];
        };
        const latest = active ?? (await fallback());
        if (!latest)
            continue;
        const parsed = await loadArtifactDoc(latest);
        loaded.push({
            type,
            file: latest,
            doc: parsed
        });
    }
    return loaded;
}
async function listHtmlFiles(dir) {
    if (!(await (0, utils_1.fileExists)(dir)))
        return [];
    const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
        .map((entry) => node_path_1.default.join(dir, entry.name));
}
function formatIssue(issue) {
    const location = issue.file ? ` (${issue.file})` : "";
    const field = issue.field ? ` [${issue.field}]` : "";
    const check = issue.check ? ` [${issue.check}]` : "";
    const fix = issue.suggestion ? `\n  Suggestion: ${issue.suggestion}` : "";
    return `- [${issue.level.toUpperCase()}] ${issue.code}${check}${field}: ${issue.message}${location}${fix}`;
}
async function writeReport(targetPath, issues) {
    const status = issues.some((issue) => issue.level === "error") ? "FAIL" : "PASS";
    const schemaIssues = issues.filter((issue) => issue.check === "schema");
    const coverageIssues = issues.filter((issue) => issue.check === "tag_coverage");
    const relevanceIssues = issues.filter((issue) => issue.check === "contract_relevance");
    const semanticIssues = issues.filter((issue) => issue.check === "semantic_consistency");
    const gate = (set) => (set.some((issue) => issue.level === "error") ? "FAIL" : "PASS");
    const content = [
        "# Prodo Validation Report",
        "",
        `Status: **${status}**`,
        `Generated at: ${new Date().toISOString()}`,
        "",
        "## Gate Results",
        `- Schema pass: ${gate(schemaIssues)}`,
        `- Tag coverage pass: ${gate(coverageIssues)}`,
        `- Contract relevance pass: ${gate(relevanceIssues)}`,
        `- Semantic consistency pass: ${gate(semanticIssues)}`,
        "",
        "## Findings",
        issues.length === 0 ? "- No issues found." : issues.map(formatIssue).join("\n"),
        ""
    ].join("\n");
    await (0, utils_1.ensureDir)(node_path_1.default.dirname(targetPath));
    await promises_1.default.writeFile(targetPath, content, "utf8");
}
async function runValidate(cwd, options) {
    const normalizedPath = (0, paths_1.normalizedBriefPath)(cwd);
    if (!(await (0, utils_1.fileExists)(normalizedPath))) {
        throw new errors_1.UserError("Missing `.prodo/briefs/normalized-brief.json`. Run `prodo-init` and create it first.");
    }
    const normalizedBrief = await (0, utils_1.readJsonFile)(normalizedPath);
    const loaded = await loadLatestArtifacts(cwd);
    const issues = [];
    for (const artifact of loaded) {
        const template = await (0, template_resolver_1.resolveTemplate)({
            cwd,
            artifactType: artifact.type
        });
        const headings = template ? (0, template_resolver_1.extractRequiredHeadingsFromTemplate)(template.content) : [];
        const schemaCheck = await (0, validator_1.validateSchema)(cwd, artifact.type, artifact.doc, headings);
        issues.push(...schemaCheck.issues.map((issue) => ({ ...issue, file: artifact.file })));
        if (artifact.type === "workflow") {
            const ext = node_path_1.default.extname(artifact.file).toLowerCase();
            if (ext !== ".md") {
                issues.push({
                    level: "error",
                    code: "workflow_markdown_missing",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: "Workflow explanation artifact must be Markdown (.md).",
                    suggestion: "Regenerate workflow so explanation is written to .md."
                });
            }
            const mmdPath = node_path_1.default.join(node_path_1.default.dirname(artifact.file), `${node_path_1.default.parse(artifact.file).name}.mmd`);
            if (!(await (0, utils_1.fileExists)(mmdPath))) {
                issues.push({
                    level: "error",
                    code: "workflow_mermaid_missing",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: "Workflow Mermaid companion file (.mmd) is missing.",
                    suggestion: "Regenerate workflow so markdown and .mmd are produced as a pair."
                });
            }
            else {
                const mmdRaw = await promises_1.default.readFile(mmdPath, "utf8");
                const mermaidLike = /(^|\n)\s*flowchart\s+/i.test(mmdRaw) || /(^|\n)\s*graph\s+/i.test(mmdRaw);
                if (!mermaidLike) {
                    issues.push({
                        level: "error",
                        code: "workflow_mermaid_invalid",
                        check: "schema",
                        artifactType: artifact.type,
                        file: mmdPath,
                        message: "Workflow Mermaid file is invalid or prose-only.",
                        suggestion: "Ensure .mmd file contains valid Mermaid diagram syntax."
                    });
                }
            }
        }
        if (artifact.type === "wireframe") {
            const ext = node_path_1.default.extname(artifact.file).toLowerCase();
            if (ext !== ".md") {
                issues.push({
                    level: "error",
                    code: "wireframe_markdown_missing",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: "Wireframe explanation artifact must be Markdown (.md).",
                    suggestion: "Regenerate wireframe so explanation is written to .md."
                });
            }
            const htmlPath = node_path_1.default.join(node_path_1.default.dirname(artifact.file), `${node_path_1.default.parse(artifact.file).name}.html`);
            if (!(await (0, utils_1.fileExists)(htmlPath))) {
                issues.push({
                    level: "error",
                    code: "wireframe_html_missing",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: "Wireframe HTML companion file is missing.",
                    suggestion: "Regenerate wireframe so markdown and .html are produced as a pair."
                });
            }
            else {
                const htmlRaw = await promises_1.default.readFile(htmlPath, "utf8");
                const htmlLooksValid = /<!doctype html>/i.test(htmlRaw) || /<html[\s>]/i.test(htmlRaw);
                if (!htmlLooksValid) {
                    issues.push({
                        level: "error",
                        code: "wireframe_html_invalid",
                        check: "schema",
                        artifactType: artifact.type,
                        file: htmlPath,
                        message: "Wireframe output is not valid HTML content.",
                        suggestion: "Ensure wireframe companion HTML contains a valid document structure."
                    });
                }
            }
            const htmlFiles = await listHtmlFiles(node_path_1.default.dirname(artifact.file));
            if (htmlFiles.length < 1) {
                issues.push({
                    level: "error",
                    code: "wireframe_screens_missing",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: "Wireframe must include at least one HTML screen artifact.",
                    suggestion: "Regenerate wireframe to create paired .md and .html screen files."
                });
            }
        }
    }
    issues.push(...(await (0, consistency_1.checkConsistency)(cwd, loaded, normalizedBrief)));
    if (options.strict) {
        for (const issue of issues) {
            if (issue.level === "warning")
                issue.level = "error";
        }
    }
    const finalReportPath = options.report ? node_path_1.default.resolve(cwd, options.report) : (0, paths_1.reportPath)(cwd);
    if (!(0, utils_1.isPathInside)(node_path_1.default.join(cwd, "product-docs"), finalReportPath)) {
        throw new errors_1.UserError("Validation report must be inside `product-docs/`.");
    }
    await writeReport(finalReportPath, issues);
    const pass = !issues.some((issue) => issue.level === "error");
    return { pass, reportPath: finalReportPath, issues };
}
