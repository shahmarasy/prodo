"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAgent = void 0;
const base_1 = require("../base");
const system_prompts_1 = require("../system-prompts");
const errors_1 = require("../../core/errors");
const dynamicImport = new Function("specifier", "return import(specifier)");
class AnthropicAgent extends base_1.BaseAgent {
    name = "anthropic";
    displayName = "Anthropic Claude";
    sdkRequired = "@anthropic-ai/sdk";
    getConfig() {
        return {
            name: this.name,
            displayName: this.displayName,
            sdkRequired: this.sdkRequired,
            envVars: ["ANTHROPIC_API_KEY"],
            defaultModel: "claude-sonnet-4-20250514"
        };
    }
    async generate(prompt, inputContext, schemaHint) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new errors_1.UserError("ANTHROPIC_API_KEY is not set. Set it to use the Anthropic agent.");
        }
        const model = process.env.PRODO_ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
        const outputLanguage = typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
            ? inputContext.outputLanguage.trim()
            : "en";
        const system = (0, system_prompts_1.buildSystemPrompt)(schemaHint, outputLanguage);
        const user = (0, system_prompts_1.buildUserMessage)(prompt, inputContext);
        let AnthropicConstructor;
        try {
            const mod = (await dynamicImport("@anthropic-ai/sdk"));
            AnthropicConstructor = mod.default;
        }
        catch {
            throw new errors_1.UserError("Anthropic SDK is not installed. Run: npm install @anthropic-ai/sdk");
        }
        const client = new AnthropicConstructor({ apiKey });
        const response = await client.messages.create({
            model,
            max_tokens: 8192,
            system,
            messages: [{ role: "user", content: user }]
        });
        const textBlock = response.content.find((block) => block.type === "text");
        const content = textBlock?.text?.trim() ?? "";
        if (!content) {
            throw new errors_1.UserError("Anthropic agent returned an empty response.");
        }
        return { body: content };
    }
}
exports.AnthropicAgent = AnthropicAgent;
