"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAgent = void 0;
const base_1 = require("../base");
const mock_provider_1 = require("../../providers/mock-provider");
class MockAgent extends base_1.BaseAgent {
    name = "mock";
    displayName = "Mock (Testing)";
    sdkRequired = null;
    provider = new mock_provider_1.MockProvider();
    async generate(prompt, inputContext, schemaHint) {
        return this.provider.generate(prompt, inputContext, schemaHint);
    }
    async isAvailable() {
        return true;
    }
    getConfig() {
        return {
            name: this.name,
            displayName: this.displayName,
            sdkRequired: null,
            envVars: []
        };
    }
}
exports.MockAgent = MockAgent;
