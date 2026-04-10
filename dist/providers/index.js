"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalRegistry = void 0;
exports.createProvider = createProvider;
const agent_registry_1 = require("../agents/agent-registry");
let cachedProvider = null;
let cachedAgentName = null;
function createProvider() {
    const agentName = process.env.PRODO_AGENT ??
        process.env.PRODO_LLM_PROVIDER ??
        "mock";
    if (cachedProvider && cachedAgentName === agentName) {
        return cachedProvider;
    }
    const registry = (0, agent_registry_1.getGlobalRegistry)();
    const agent = registry.get(agentName);
    if (!agent) {
        const available = registry.list().map((a) => a.name).join(", ");
        throw new Error(`Unknown agent: "${agentName}". Available: ${available}`);
    }
    cachedProvider = registry.toProvider(agent);
    cachedAgentName = agentName;
    return cachedProvider;
}
var agent_registry_2 = require("../agents/agent-registry");
Object.defineProperty(exports, "getGlobalRegistry", { enumerable: true, get: function () { return agent_registry_2.getGlobalRegistry; } });
