"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAgent = void 0;
const base_1 = require("../base");
const system_prompts_1 = require("../system-prompts");
const errors_1 = require("../../core/errors");
const dynamicImport = new Function("specifier", "return import(specifier)");
class GoogleAgent extends base_1.BaseAgent {
    name = "google";
    displayName = "Google Gemini";
    sdkRequired = "@google/generative-ai";
    getConfig() {
        return {
            name: this.name,
            displayName: this.displayName,
            sdkRequired: this.sdkRequired,
            envVars: ["GOOGLE_API_KEY"],
            defaultModel: "gemini-2.0-flash"
        };
    }
    async generate(prompt, inputContext, schemaHint) {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new errors_1.UserError("GOOGLE_API_KEY is not set. Set it to use the Google Gemini agent.");
        }
        const model = process.env.PRODO_GOOGLE_MODEL ?? "gemini-2.0-flash";
        const outputLanguage = typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
            ? inputContext.outputLanguage.trim()
            : "en";
        const system = (0, system_prompts_1.buildSystemPrompt)(schemaHint, outputLanguage);
        const user = (0, system_prompts_1.buildUserMessage)(prompt, inputContext);
        let GoogleGenerativeAI;
        try {
            const mod = (await dynamicImport("@google/generative-ai"));
            GoogleGenerativeAI = mod.GoogleGenerativeAI;
        }
        catch {
            throw new errors_1.UserError("Google Generative AI SDK is not installed. Run: npm install @google/generative-ai");
        }
        const client = new GoogleGenerativeAI(apiKey);
        const generativeModel = client.getGenerativeModel({
            model,
            systemInstruction: system
        });
        const result = await generativeModel.generateContent(user);
        const content = result.response.text().trim();
        if (!content) {
            throw new errors_1.UserError("Google Gemini agent returned an empty response.");
        }
        return { body: content };
    }
}
exports.GoogleAgent = GoogleAgent;
