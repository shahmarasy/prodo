"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixSkill = void 0;
const fix_1 = require("../core/fix");
exports.fixSkill = {
    manifest: {
        name: "fix",
        description: "Auto-regenerate artifacts that failed validation with backup and rollback",
        category: "validation",
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "agent", type: "string", required: false, description: "Agent profile name" },
            { name: "strict", type: "boolean", required: false, description: "Treat warnings as errors" },
            { name: "dryRun", type: "boolean", required: false, description: "Preview without applying" }
        ],
        outputs: [
            { name: "applied", type: "string", description: "Whether fix was applied" },
            { name: "finalPass", type: "string", description: "Whether validation passed after fix" },
            { name: "reportPath", type: "path", description: "Path to validation report" }
        ]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.cwd;
        const result = await (0, fix_1.runFix)({
            cwd,
            agent: inputs.agent ?? context.agent,
            strict: Boolean(inputs.strict),
            dryRun: Boolean(inputs.dryRun),
            log: context.log
        });
        return {
            applied: result.applied,
            finalPass: result.finalPass,
            reportPath: result.reportPath,
            targetCount: result.proposal.targets.length
        };
    }
};
