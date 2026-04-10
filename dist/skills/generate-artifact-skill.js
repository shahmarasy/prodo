"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArtifactSkill = void 0;
const artifacts_1 = require("../core/artifacts");
exports.generateArtifactSkill = {
    manifest: {
        name: "generate-artifact",
        description: "Generate a single artifact (PRD, workflow, wireframe, stories, techspec)",
        category: "artifact",
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "artifactType", type: "string", required: true, description: "Artifact type to generate" },
            { name: "from", type: "path", required: false, description: "Override path to normalized-brief.json" },
            { name: "out", type: "path", required: false, description: "Override output path" }
        ],
        outputs: [
            { name: "filePath", type: "path", description: "Path to generated artifact" }
        ]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.cwd;
        const filePath = await (0, artifacts_1.generateArtifact)({
            artifactType: inputs.artifactType,
            cwd,
            normalizedBriefOverride: inputs.from,
            outPath: inputs.out,
            agent: context.agent
        });
        context.log(`${inputs.artifactType.toUpperCase()} generated: ${filePath}`);
        return { filePath };
    }
};
