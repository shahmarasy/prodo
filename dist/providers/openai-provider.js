"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const errors_1 = require("../errors");
class OpenAIProvider {
    apiKey;
    model;
    baseUrl;
    constructor() {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            throw new errors_1.UserError("OPENAI_API_KEY missing. Set it or use PRODO_LLM_PROVIDER=mock.");
        }
        this.apiKey = key;
        this.model = process.env.PRODO_OPENAI_MODEL ?? "gpt-4o-mini";
        this.baseUrl = process.env.PRODO_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    }
    async generate(prompt, inputContext, schemaHint) {
        const outputLanguage = typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
            ? inputContext.outputLanguage.trim()
            : "en";
        const mode = schemaHint.artifactType;
        const system = mode === "normalize"
            ? `You normalize messy human product briefs into strict JSON.
Return valid JSON only, no markdown. Include confidence scores (0..1) for critical fields.`
            : mode === "semantic_consistency"
                ? `You detect semantic inconsistencies between paired artifacts.
Return valid JSON only: { "issues": [{level, code, check, contract_id, file, message, suggestion}] }.`
                : mode === "contract_relevance"
                    ? `You verify whether tagged content actually matches the referenced contract text.
Return valid JSON only: { "relevant": boolean, "score": number, "reason": string }.`
                    : `You are a product-document generator.
Return only Markdown body content.
Headings required:
${schemaHint.requiredHeadings.join("\n")}
Required contract tags:
${schemaHint.requiredContracts.join(", ")}
Use tags like [G1], [F2], [C1] where relevant.
Output language: ${outputLanguage}
Do not translate required headings.`;
        const user = `${prompt}\n\nContext JSON:\n${JSON.stringify(inputContext, null, 2)}`;
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user }
                ],
                temperature: 0.2
            })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new errors_1.UserError(`OpenAI request failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const content = payload.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new errors_1.UserError("OpenAI provider returned an empty response.");
        }
        return { body: content };
    }
}
exports.OpenAIProvider = OpenAIProvider;
