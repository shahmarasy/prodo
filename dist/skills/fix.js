"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixSkill = void 0;
const fix_1 = require("../core/fix");
exports.fixSkill = {
    manifest: {
        name: "fix",
        version: "2.0.0",
        description: "Auto-regenerate failing artifacts with backup, proposal, and validation",
        category: "validation",
        depends_on: [],
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" }
        ],
        outputs: [
            { name: "validationResult", type: "json", description: "Final validation result after fix" }
        ],
        tags: ["fix", "repair", "validation"]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.state.cwd;
        context.progress(1, 3, "Running fix pipeline...");
        const result = await (0, fix_1.runFix)({
            cwd,
            agent: context.agent,
            log: context.log
        });
        context.progress(3, 3, result.finalPass ? "Fix complete." : "Fix applied, issues remain.");
        context.state.validationResult = result.finalPass
            ? { pass: true, reportPath: result.reportPath, issues: [] }
            : undefined;
        return {
            validationResult: {
                pass: result.finalPass,
                reportPath: result.reportPath,
                applied: result.applied,
                targetCount: result.proposal.targets.length
            }
        };
    }
};
