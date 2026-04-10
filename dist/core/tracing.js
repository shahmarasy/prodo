"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTraceMap = buildTraceMap;
exports.checkRequirementCompleteness = checkRequirementCompleteness;
const markdown_1 = require("./markdown");
function buildTraceMap(normalizedBrief, loadedArtifacts) {
    const traceMap = new Map();
    function registerContracts(items, category) {
        for (const item of items) {
            traceMap.set(item.id, {
                contractId: item.id,
                contractText: item.text,
                category,
                references: []
            });
        }
    }
    registerContracts(normalizedBrief.contracts.goals, "goals");
    registerContracts(normalizedBrief.contracts.core_features, "core_features");
    registerContracts(normalizedBrief.contracts.constraints, "constraints");
    for (const artifact of loadedArtifacts) {
        const tagged = (0, markdown_1.taggedLinesByContract)(artifact.doc.body);
        for (const { contractId, line } of tagged) {
            const entry = traceMap.get(contractId);
            if (entry) {
                entry.references.push({
                    artifactType: artifact.type,
                    file: artifact.file,
                    line
                });
            }
        }
    }
    return traceMap;
}
function checkRequirementCompleteness(traceMap, normalizedBrief, presentArtifactTypes) {
    const issues = [];
    if (presentArtifactTypes.length === 0)
        return issues;
    for (const [contractId, entry] of traceMap) {
        if (entry.references.length === 0) {
            issues.push({
                level: "warning",
                code: "untraced_requirement",
                check: "tracing",
                message: `Contract ${contractId} ("${truncate(entry.contractText, 60)}") is not referenced in any generated artifact.`,
                suggestion: `Ensure [${contractId}] tag appears in at least one artifact body.`
            });
        }
    }
    const hasPrd = presentArtifactTypes.includes("prd");
    if (hasPrd) {
        for (const [contractId, entry] of traceMap) {
            if (entry.category === "goals") {
                const inPrd = entry.references.some((r) => r.artifactType === "prd");
                if (!inPrd && entry.references.length > 0) {
                    issues.push({
                        level: "warning",
                        code: "goal_missing_in_prd",
                        check: "tracing",
                        message: `Goal ${contractId} appears in downstream artifacts but is not traced in the PRD.`,
                        suggestion: `Add [${contractId}] tag to the PRD to maintain traceability.`
                    });
                }
            }
        }
    }
    return issues;
}
function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength - 3)}...`;
}
