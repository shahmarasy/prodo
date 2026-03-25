"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_COMMANDS = void 0;
exports.buildWorkflowCommands = buildWorkflowCommands;
const BASE_WORKFLOW_COMMANDS = [
    { name: "prodo-normalize", cliSubcommand: "normalize", description: "Normalize start brief into normalized brief JSON." },
    { name: "prodo-prd", cliSubcommand: "prd", description: "Generate PRD artifact from normalized brief." },
    { name: "prodo-workflow", cliSubcommand: "workflow", description: "Generate workflow artifact." },
    { name: "prodo-wireframe", cliSubcommand: "wireframe", description: "Generate wireframe artifact." },
    { name: "prodo-stories", cliSubcommand: "stories", description: "Generate stories artifact." },
    { name: "prodo-techspec", cliSubcommand: "techspec", description: "Generate technical specification artifact." },
    { name: "prodo-validate", cliSubcommand: "validate", description: "Run schema and cross-artifact consistency validation." },
    { name: "prodo-fix", cliSubcommand: "fix", description: "Auto-fix artifacts based on validation report and brief." }
];
exports.WORKFLOW_COMMANDS = BASE_WORKFLOW_COMMANDS;
function buildWorkflowCommands(artifactTypes) {
    const commandByName = new Map(BASE_WORKFLOW_COMMANDS.map((item) => [item.name, item]));
    for (const type of artifactTypes) {
        const name = `prodo-${type}`;
        if (commandByName.has(name))
            continue;
        commandByName.set(name, {
            name,
            cliSubcommand: type,
            description: `Generate ${type} artifact from normalized brief.`
        });
    }
    return Array.from(commandByName.values());
}
