"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSkill = void 0;
const validate_1 = require("../core/validate");
exports.validateSkill = {
    manifest: {
        name: "validate",
        description: "Run cross-artifact validation and generate a report",
        category: "validation",
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "strict", type: "boolean", required: false, description: "Treat warnings as errors" },
            { name: "report", type: "path", required: false, description: "Override report output path" }
        ],
        outputs: [
            { name: "pass", type: "string", description: "Whether validation passed" },
            { name: "reportPath", type: "path", description: "Path to validation report" }
        ]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.cwd;
        const result = await (0, validate_1.runValidate)(cwd, {
            strict: Boolean(inputs.strict),
            report: inputs.report
        });
        context.log(`Validation ${result.pass ? "passed" : "failed"}: ${result.reportPath}`);
        return { pass: result.pass, reportPath: result.reportPath, issueCount: result.issues.length };
    }
};
