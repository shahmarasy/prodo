"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
exports.getGlobalRegistry = getGlobalRegistry;
exports.resetGlobalRegistry = resetGlobalRegistry;
const errors_1 = require("../core/errors");
const mock_1 = require("./mock");
const openai_1 = require("./openai");
const anthropic_1 = require("./anthropic");
const google_1 = require("./google");
const AGENT_ALIASES = {
    mock: "mock",
    openai: "openai",
    anthropic: "anthropic",
    claude: "anthropic",
    google: "google",
    gemini: "google"
};
class AgentRegistry {
    agents = new Map();
    register(agent) {
        this.agents.set(agent.name, agent);
    }
    list() {
        return Array.from(this.agents.values());
    }
    get(name) {
        const normalized = AGENT_ALIASES[name.toLowerCase().trim()] ?? name.toLowerCase().trim();
        return this.agents.get(normalized);
    }
    async resolve(name) {
        const agentName = this.resolveAgentName(name);
        const agent = this.get(agentName);
        if (!agent) {
            const available = this.list().map((a) => a.name).join(", ");
            throw new errors_1.UserError(`Unknown agent: "${agentName}". Available agents: ${available}`);
        }
        return agent;
    }
    resolveAgentName(override) {
        if (override)
            return override;
        const fromEnv = process.env.PRODO_AGENT;
        if (fromEnv)
            return fromEnv;
        const fromLegacy = process.env.PRODO_LLM_PROVIDER;
        if (fromLegacy)
            return fromLegacy;
        const isTest = process.env.NODE_ENV === "test" ||
            process.env.PRODO_TEST === "1";
        if (isTest)
            return "mock";
        return "mock";
    }
    toProvider(agent) {
        return {
            generate: (prompt, inputContext, schemaHint) => agent.generate(prompt, inputContext, schemaHint)
        };
    }
}
exports.AgentRegistry = AgentRegistry;
let globalRegistry = null;
function createDefaultRegistry() {
    const registry = new AgentRegistry();
    registry.register(new mock_1.MockAgent());
    registry.register(new openai_1.OpenAIAgent());
    registry.register(new anthropic_1.AnthropicAgent());
    registry.register(new google_1.GoogleAgent());
    return registry;
}
function getGlobalRegistry() {
    if (!globalRegistry) {
        globalRegistry = createDefaultRegistry();
    }
    return globalRegistry;
}
function resetGlobalRegistry() {
    globalRegistry = null;
}
