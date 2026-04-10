"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkConsistency = checkConsistency;
const node_path_1 = __importDefault(require("node:path"));
const artifact_registry_1 = require("./artifact-registry");
const markdown_1 = require("./markdown");
const normalized_brief_1 = require("./normalized-brief");
const providers_1 = require("../providers");
const terminology_1 = require("./terminology");
const tracing_1 = require("./tracing");
function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "string");
}
function readCoverage(frontmatter) {
    const coverage = frontmatter.contract_coverage;
    return {
        goals: asStringArray(coverage?.goals),
        core_features: asStringArray(coverage?.core_features),
        constraints: asStringArray(coverage?.constraints)
    };
}
async function checkMissingArtifacts(cwd, loadedArtifacts) {
    const expectedTypes = await (0, artifact_registry_1.listArtifactTypes)(cwd);
    const present = new Set(loadedArtifacts.map((item) => item.type));
    const missing = expectedTypes.filter((type) => !present.has(type));
    if (missing.length === 0)
        return [];
    return [
        {
            level: "warning",
            code: "missing_artifacts",
            check: "schema",
            message: `Some artifacts are missing from outputs: ${missing.join(", ")}`,
            suggestion: "Run the corresponding prodo-* commands before final validation."
        }
    ];
}
async function checkContractCoverage(cwd, loaded, normalizedBrief) {
    const issues = [];
    const normalized = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedBrief);
    const expected = (0, normalized_brief_1.contractIds)(normalized.contracts);
    for (const artifact of loaded) {
        const def = await (0, artifact_registry_1.getArtifactDefinition)(cwd, artifact.type);
        const coverage = readCoverage(artifact.doc.frontmatter);
        for (const key of def.required_contracts) {
            const missing = expected[key].filter((id) => !coverage[key].includes(id));
            if (missing.length === 0)
                continue;
            issues.push({
                level: "error",
                code: "missing_contract_coverage",
                check: "tag_coverage",
                artifactType: artifact.type,
                file: artifact.file,
                field: `frontmatter.contract_coverage.${key}`,
                message: `Artifact is missing required contract IDs for ${key}: ${missing.join(", ")}`,
                suggestion: "Regenerate artifact and include explicit contract tags such as [G1], [F2], [C1]."
            });
        }
    }
    return issues;
}
function checkUpstreamReferences(loaded) {
    const issues = [];
    const filesByName = new Set(loaded.map((item) => node_path_1.default.normalize(item.file)));
    for (const artifact of loaded) {
        const upstream = artifact.doc.frontmatter.upstream_artifacts;
        if (!Array.isArray(upstream))
            continue;
        for (const rawItem of upstream) {
            if (typeof rawItem !== "string")
                continue;
            const resolved = node_path_1.default.normalize(node_path_1.default.resolve(node_path_1.default.dirname(artifact.file), rawItem));
            if (!filesByName.has(resolved)) {
                issues.push({
                    level: "error",
                    code: "broken_upstream_reference",
                    check: "schema",
                    artifactType: artifact.type,
                    file: artifact.file,
                    field: "frontmatter.upstream_artifacts",
                    message: `Referenced upstream artifact not found: ${rawItem}`,
                    suggestion: "Regenerate this artifact or update upstream_artifacts paths to existing outputs."
                });
            }
        }
    }
    return issues;
}
// taggedLinesByContract is now imported from ./markdown
function parseJsonObject(raw, fallback) {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch {
        return fallback;
    }
}
function hasEnglishLeak(body) {
    const markers = [" the ", " and ", " with ", " user ", " should ", " must "];
    const normalized = ` ${body.toLowerCase().replace(/\s+/g, " ")} `;
    return markers.filter((item) => normalized.includes(item)).length >= 2;
}
function checkLanguageConsistency(loaded) {
    const issues = [];
    const languages = new Set();
    for (const artifact of loaded) {
        const lang = String((artifact.doc.frontmatter.language ?? "")).toLowerCase();
        if (lang)
            languages.add(lang);
        if (lang.startsWith("tr") && hasEnglishLeak(artifact.doc.body)) {
            issues.push({
                level: "error",
                code: "language_mixed_content",
                check: "schema",
                artifactType: artifact.type,
                file: artifact.file,
                message: "Artifact contains mixed language content while target language is Turkish.",
                suggestion: "Regenerate artifact with strict Turkish output."
            });
        }
    }
    if (languages.size > 1) {
        issues.push({
            level: "error",
            code: "language_inconsistent_across_artifacts",
            check: "schema",
            message: "Artifacts have inconsistent language settings.",
            suggestion: "Regenerate artifacts so all frontmatter.language values match."
        });
    }
    return issues;
}
async function checkContractRelevance(loaded, normalizedBrief) {
    const normalized = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedBrief);
    const contractMap = new Map();
    for (const item of normalized.contracts.goals)
        contractMap.set(item.id, item.text);
    for (const item of normalized.contracts.core_features)
        contractMap.set(item.id, item.text);
    for (const item of normalized.contracts.constraints)
        contractMap.set(item.id, item.text);
    const provider = (0, providers_1.createProvider)();
    const issues = [];
    for (const artifact of loaded) {
        const taggedLines = (0, markdown_1.taggedLinesByContract)(artifact.doc.body);
        for (const tagged of taggedLines) {
            const contractText = contractMap.get(tagged.contractId);
            if (!contractText) {
                issues.push({
                    level: "error",
                    code: "unknown_contract_tag",
                    check: "contract_relevance",
                    artifactType: artifact.type,
                    file: artifact.file,
                    field: tagged.contractId,
                    message: `Unknown contract tag used: ${tagged.contractId}`,
                    suggestion: "Use only contract IDs that exist in normalized brief contracts."
                });
                continue;
            }
            const response = await provider.generate("Evaluate if tagged line semantically matches contract text.", {
                contract_id: tagged.contractId,
                contract_text: contractText,
                context_text: tagged.line
            }, {
                artifactType: "contract_relevance",
                requiredHeadings: [],
                requiredContracts: []
            });
            const verdict = parseJsonObject(response.body, {});
            const relevant = Boolean(verdict.relevant);
            if (!relevant) {
                issues.push({
                    level: "error",
                    code: "irrelevant_contract_tag_usage",
                    check: "contract_relevance",
                    artifactType: artifact.type,
                    file: artifact.file,
                    field: tagged.contractId,
                    message: `Tag ${tagged.contractId} does not match nearby content semantically.`,
                    suggestion: verdict.reason ?? "Rewrite the tagged sentence so it clearly addresses the referenced contract."
                });
            }
        }
    }
    return issues;
}
async function checkSemanticPairs(loaded) {
    const byType = new Map();
    for (const artifact of loaded)
        byType.set(artifact.type, artifact);
    const pairs = [
        ["prd", "stories"],
        ["workflow", "techspec"],
        ["workflow", "wireframe"]
    ];
    const provider = (0, providers_1.createProvider)();
    const issues = [];
    for (const [leftType, rightType] of pairs) {
        const left = byType.get(leftType);
        const right = byType.get(rightType);
        if (!left || !right)
            continue;
        const result = await provider.generate("Compare paired artifacts semantically and return contradictions.", {
            pair: {
                left_type: leftType,
                left_file: left.file,
                left_coverage: readCoverage(left.doc.frontmatter),
                left_body: left.doc.body,
                right_type: rightType,
                right_file: right.file,
                right_coverage: readCoverage(right.doc.frontmatter),
                right_body: right.doc.body
            }
        }, {
            artifactType: "semantic_consistency",
            requiredHeadings: [],
            requiredContracts: []
        });
        const parsed = parseJsonObject(result.body, { issues: [] });
        for (const item of parsed.issues ?? []) {
            issues.push({
                level: (item.level === "warning" ? "warning" : "error"),
                code: typeof item.code === "string" ? item.code : "semantic_inconsistency",
                check: "semantic_consistency",
                file: typeof item.file === "string" ? item.file : left.file,
                field: typeof item.contract_id === "string" ? item.contract_id : undefined,
                message: typeof item.message === "string"
                    ? item.message
                    : `Semantic mismatch between ${leftType} and ${rightType}.`,
                suggestion: typeof item.suggestion === "string"
                    ? item.suggestion
                    : `Align ${leftType} and ${rightType} decisions and regenerate.`
            });
        }
    }
    return issues;
}
function checkCrossReferences(loadedArtifacts) {
    const issues = [];
    const artifactTypeNames = new Set(loadedArtifacts.map((a) => a.type));
    const sectionsByType = new Map();
    for (const artifact of loadedArtifacts) {
        const sections = (0, markdown_1.parseMarkdownSections)(artifact.doc.body);
        const headingSet = new Set(sections.map((s) => s.headingKey));
        sectionsByType.set(artifact.type, headingSet);
    }
    const crossRefPattern = /(?:see|refer to|as (?:defined|described|specified) in)\s+(prd|workflow|wireframe|stories|techspec)(?:\s+(?:section\s+)?[""]?([^"".,)\n]+)[""]?)?/gi;
    for (const artifact of loadedArtifacts) {
        const matches = artifact.doc.body.matchAll(crossRefPattern);
        for (const match of matches) {
            const refType = match[1].toLowerCase();
            const refSection = match[2]?.trim();
            if (!artifactTypeNames.has(refType)) {
                issues.push({
                    level: "warning",
                    code: "broken_cross_reference",
                    check: "cross_reference",
                    artifactType: artifact.type,
                    file: artifact.file,
                    message: `Cross-reference to "${refType}" but that artifact does not exist.`,
                    suggestion: `Generate the ${refType} artifact or remove the cross-reference.`
                });
                continue;
            }
            if (refSection) {
                const targetSections = sectionsByType.get(refType);
                if (targetSections) {
                    const normalizedRef = refSection.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
                    const found = [...targetSections].some((s) => s.includes(normalizedRef) || normalizedRef.includes(s));
                    if (!found) {
                        issues.push({
                            level: "warning",
                            code: "broken_cross_reference",
                            check: "cross_reference",
                            artifactType: artifact.type,
                            file: artifact.file,
                            message: `Cross-reference to "${refType} section ${refSection}" but that section was not found.`,
                            suggestion: `Verify the section name or update the cross-reference.`
                        });
                    }
                }
            }
        }
    }
    return issues;
}
async function checkConsistency(cwd, loadedArtifacts, normalizedBrief) {
    const baseIssues = [
        ...(await checkMissingArtifacts(cwd, loadedArtifacts)),
        ...(await checkContractCoverage(cwd, loadedArtifacts, normalizedBrief)),
        ...checkUpstreamReferences(loadedArtifacts),
        ...checkLanguageConsistency(loadedArtifacts)
    ];
    const relevanceIssues = await checkContractRelevance(loadedArtifacts, normalizedBrief);
    const semanticIssues = await checkSemanticPairs(loadedArtifacts);
    const crossRefIssues = checkCrossReferences(loadedArtifacts);
    let terminologyIssues = [];
    let tracingIssues = [];
    try {
        const parsed = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedBrief);
        const termMap = (0, terminology_1.buildTermMap)(parsed, loadedArtifacts);
        terminologyIssues = (0, terminology_1.checkTermReconciliation)(termMap);
        const traceMap = (0, tracing_1.buildTraceMap)(parsed, loadedArtifacts);
        const presentTypes = loadedArtifacts.map((a) => a.type);
        tracingIssues = (0, tracing_1.checkRequirementCompleteness)(traceMap, parsed, presentTypes);
    }
    catch {
        // normalized brief parse failed — skip terminology/tracing (other checks will catch it)
    }
    return [
        ...baseIssues,
        ...relevanceIssues,
        ...semanticIssues,
        ...crossRefIssues,
        ...terminologyIssues,
        ...tracingIssues
    ];
}
