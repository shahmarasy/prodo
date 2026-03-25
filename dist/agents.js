"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_IDS = void 0;
exports.isSupportedAgent = isSupportedAgent;
exports.resolveAgent = resolveAgent;
exports.loadAgentCommandSet = loadAgentCommandSet;
const errors_1 = require("./errors");
exports.AGENT_IDS = ["codex", "gemini-cli", "claude-cli"];
function isSupportedAgent(agent) {
    if (!agent)
        return false;
    return exports.AGENT_IDS.includes(agent);
}
function resolveAgent(agent) {
    if (!agent)
        return undefined;
    if (!isSupportedAgent(agent)) {
        throw new errors_1.UserError(`Unsupported agent: ${agent}. Supported: ${exports.AGENT_IDS.join(", ")}`);
    }
    return agent;
}
async function loadAgentCommandSet(_cwd, agent) {
    const prefix = "/prodo";
    return {
        agent,
        description: "Agent-specific command set for Prodo artifact pipeline.",
        recommended_sequence: [
            { command: "prodo init . --ai <agent> --lang <en|tr>", purpose: "Initialize Prodo scaffold and agent commands." },
            { command: `${prefix}-normalize`, purpose: "Normalize start brief into normalized brief JSON." },
            { command: `${prefix}-prd`, purpose: "Generate PRD artifact." },
            { command: `${prefix}-workflow`, purpose: "Generate workflow artifact." },
            { command: `${prefix}-wireframe`, purpose: "Generate wireframe artifact." },
            { command: `${prefix}-stories`, purpose: "Generate stories artifact." },
            { command: `${prefix}-techspec`, purpose: "Generate techspec artifact." },
            { command: `${prefix}-validate`, purpose: "Run validation report." },
            { command: `${prefix}-fix`, purpose: "Fix artifacts when validation fails." }
        ],
        artifact_shortcuts: {
            normalize: `${prefix}-normalize`,
            prd: `${prefix}-prd`,
            workflow: `${prefix}-workflow`,
            wireframe: `${prefix}-wireframe`,
            stories: `${prefix}-stories`,
            techspec: `${prefix}-techspec`,
            validate: `${prefix}-validate`,
            fix: `${prefix}-fix`
        }
    };
}
