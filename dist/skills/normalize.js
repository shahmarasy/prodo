"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSkill = void 0;
const normalize_1 = require("../core/normalize");
exports.normalizeSkill = {
    manifest: {
        name: "normalize",
        version: "2.0.0",
        description: "Normalize a product brief into structured JSON with contracts and confidence scores",
        category: "core",
        depends_on: [],
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" }
        ],
        outputs: [
            { name: "normalizedBriefPath", type: "path", description: "Path to normalized-brief.json" }
        ],
        tags: ["brief", "normalization"]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.state.cwd;
        context.progress(1, 2, "Normalizing brief...");
        const outPath = await (0, normalize_1.runNormalize)({ cwd });
        context.progress(2, 2, "Brief normalized.");
        context.log(`Normalized brief written to: ${outPath}`);
        context.state.normalizedBriefPath = outPath;
        return { normalizedBriefPath: outPath };
    }
};
