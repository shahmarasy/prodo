"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
const mock_provider_1 = require("./mock-provider");
const openai_provider_1 = require("./openai-provider");
function createProvider() {
    const provider = (process.env.PRODO_LLM_PROVIDER ?? "mock").toLowerCase();
    if (provider === "openai") {
        return new openai_provider_1.OpenAIProvider();
    }
    return new mock_provider_1.MockProvider();
}
