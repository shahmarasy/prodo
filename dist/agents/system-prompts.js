"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserMessage = buildUserMessage;
function buildSystemPrompt(schemaHint, outputLanguage) {
    const mode = schemaHint.artifactType;
    if (mode === "normalize") {
        return `You normalize messy human product briefs into strict JSON.
Return valid JSON only, no markdown. Include confidence scores (0..1) for critical fields.
Preserve source language and Unicode characters exactly; never transliterate Turkish letters to ASCII.`;
    }
    if (mode === "semantic_consistency") {
        return `You detect semantic inconsistencies between paired artifacts.
Return valid JSON only: { "issues": [{level, code, check, contract_id, file, message, suggestion}] }.`;
    }
    if (mode === "contract_relevance") {
        return `You verify whether tagged content actually matches the referenced contract text.
Return valid JSON only: { "relevant": boolean, "score": number, "reason": string }.`;
    }
    return `You are a product-document generator.
Return only Markdown body content.
Headings required:
${schemaHint.requiredHeadings.join("\n")}
Required contract tags:
${schemaHint.requiredContracts.join(", ")}
Use tags like [G1], [F2], [C1] where relevant.
Output language: ${outputLanguage}
Do not translate required headings.`;
}
function buildUserMessage(prompt, inputContext) {
    return `${prompt}\n\nContext JSON:\n${JSON.stringify(inputContext, null, 2)}`;
}
