"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSkill = void 0;
const normalize_1 = require("../core/normalize");
exports.normalizeSkill = {
    manifest: {
        name: "normalize",
        description: "Normalize a product brief into structured JSON with contracts and confidence scores",
        category: "core",
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "brief", type: "path", required: false, description: "Override path to brief.md" },
            { name: "out", type: "path", required: false, description: "Override output path" }
        ],
        outputs: [
            { name: "normalizedBriefPath", type: "path", description: "Path to normalized-brief.json" }
        ]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.cwd;
        const outPath = await (0, normalize_1.runNormalize)({
            cwd,
            brief: inputs.brief,
            out: inputs.out
        });
        context.log(`Normalized brief written to: ${outPath}`);
        return { normalizedBriefPath: outPath };
    }
};
