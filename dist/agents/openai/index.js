"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAgent = void 0;
const base_1 = require("../base");
const system_prompts_1 = require("../system-prompts");
const errors_1 = require("../../core/errors");
const dynamicImport = new Function("specifier", "return import(specifier)");
class OpenAIAgent extends base_1.BaseAgent {
    name = "openai";
    displayName = "OpenAI";
    sdkRequired = "openai";
    getConfig() {
        return {
            name: this.name,
            displayName: this.displayName,
            sdkRequired: this.sdkRequired,
            envVars: ["OPENAI_API_KEY"],
            defaultModel: "gpt-4o-mini"
        };
    }
    async generate(prompt, inputContext, schemaHint) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new errors_1.UserError("OPENAI_API_KEY is not set. Set it to use the OpenAI agent.");
        }
        const model = process.env.PRODO_OPENAI_MODEL ?? "gpt-4o-mini";
        const baseURL = process.env.PRODO_OPENAI_BASE_URL ?? undefined;
        const outputLanguage = typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
            ? inputContext.outputLanguage.trim()
            : "en";
        const system = (0, system_prompts_1.buildSystemPrompt)(schemaHint, outputLanguage);
        const user = (0, system_prompts_1.buildUserMessage)(prompt, inputContext);
        let OpenAIConstructor;
        try {
            const mod = (await dynamicImport("openai"));
            OpenAIConstructor = mod.default;
        }
        catch {
            throw new errors_1.UserError("OpenAI SDK is not installed. Run: npm install openai");
        }
        const client = new OpenAIConstructor({ apiKey, baseURL });
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user }
            ],
            temperature: 0.2
        });
        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            throw new errors_1.UserError("OpenAI agent returned an empty response.");
        }
        return { body: content };
    }
}
exports.OpenAIAgent = OpenAIAgent;
