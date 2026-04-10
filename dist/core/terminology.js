"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTermMap = buildTermMap;
exports.checkTermReconciliation = checkTermReconciliation;
const markdown_1 = require("./markdown");
function normalizeTerm(term) {
    return term
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function extractBoldTerms(body) {
    const matches = body.match(/\*\*([^*]+)\*\*/g) ?? [];
    return matches
        .map((m) => m.replace(/\*\*/g, "").trim())
        .filter((t) => t.length > 2 && t.length < 60);
}
function buildTermMap(normalizedBrief, loadedArtifacts) {
    const termMap = new Map();
    function addTerm(term, source, definition) {
        const normalized = normalizeTerm(term);
        if (!normalized || normalized.length < 2)
            return;
        const existing = termMap.get(normalized);
        if (existing) {
            existing.sources.push(source);
            if (definition && !existing.definition) {
                existing.definition = definition;
            }
        }
        else {
            termMap.set(normalized, {
                term,
                normalizedTerm: normalized,
                definition,
                sources: [source]
            });
        }
    }
    addTerm(normalizedBrief.product_name, { artifactType: "brief", file: "brief.md" });
    for (const goal of normalizedBrief.goals) {
        addTerm(goal, { artifactType: "brief", file: "brief.md" }, goal);
    }
    for (const feature of normalizedBrief.core_features) {
        addTerm(feature, { artifactType: "brief", file: "brief.md" }, feature);
    }
    for (const constraint of normalizedBrief.constraints) {
        addTerm(constraint, { artifactType: "brief", file: "brief.md" }, constraint);
    }
    for (const contract of normalizedBrief.contracts.goals) {
        addTerm(contract.text, { artifactType: "brief", file: "brief.md" }, contract.text);
    }
    for (const contract of normalizedBrief.contracts.core_features) {
        addTerm(contract.text, { artifactType: "brief", file: "brief.md" }, contract.text);
    }
    for (const contract of normalizedBrief.contracts.constraints) {
        addTerm(contract.text, { artifactType: "brief", file: "brief.md" }, contract.text);
    }
    for (const artifact of loadedArtifacts) {
        const sections = (0, markdown_1.parseMarkdownSections)(artifact.doc.body);
        for (const section of sections) {
            if (section.level === 2) {
                addTerm(section.heading, {
                    artifactType: artifact.type,
                    file: artifact.file,
                    heading: section.heading
                });
            }
        }
        const boldTerms = extractBoldTerms(artifact.doc.body);
        for (const boldTerm of boldTerms) {
            addTerm(boldTerm, { artifactType: artifact.type, file: artifact.file });
        }
    }
    return termMap;
}
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
function sharesStem(a, b) {
    const wordsA = a.split(/\s+/).filter((w) => w.length > 3);
    const wordsB = b.split(/\s+/).filter((w) => w.length > 3);
    for (const wa of wordsA) {
        for (const wb of wordsB) {
            const shorter = Math.min(wa.length, wb.length);
            const prefix = Math.min(4, shorter);
            if (wa.slice(0, prefix) === wb.slice(0, prefix) && wa !== wb) {
                return true;
            }
        }
    }
    return false;
}
function checkTermReconciliation(termMap) {
    const issues = [];
    const entries = Array.from(termMap.values()).filter((e) => e.sources.length > 0 && e.normalizedTerm.length > 3);
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i];
            const b = entries[j];
            if (a.normalizedTerm === b.normalizedTerm)
                continue;
            const dist = levenshtein(a.normalizedTerm, b.normalizedTerm);
            const maxLen = Math.max(a.normalizedTerm.length, b.normalizedTerm.length);
            const ratio = dist / maxLen;
            const isSimilar = (ratio < 0.25 && maxLen > 5) || sharesStem(a.normalizedTerm, b.normalizedTerm);
            if (isSimilar) {
                const aTypes = [...new Set(a.sources.map((s) => s.artifactType))];
                const bTypes = [...new Set(b.sources.map((s) => s.artifactType))];
                const crossDoc = aTypes.some((t) => !bTypes.includes(t)) || bTypes.some((t) => !aTypes.includes(t));
                if (crossDoc) {
                    issues.push({
                        level: "warning",
                        code: "term_inconsistency",
                        check: "terminology",
                        message: `Similar terms used across documents: "${a.term}" (${aTypes.join(", ")}) vs "${b.term}" (${bTypes.join(", ")})`,
                        suggestion: "Standardize terminology across all artifacts to avoid ambiguity."
                    });
                }
            }
        }
    }
    return issues;
}
