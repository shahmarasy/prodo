"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArtifactSkill = createArtifactSkill;
const artifacts_1 = require("../core/artifacts");
const constants_1 = require("../core/constants");
function createArtifactSkill(artifactType, upstream) {
    const resolvedUpstream = upstream ?? (0, constants_1.defaultUpstreamByArtifact)(artifactType);
    const depends_on = ["normalize", ...resolvedUpstream];
    const manifest = {
        name: artifactType,
        version: "2.0.0",
        description: `Generate ${artifactType} artifact from normalized brief`,
        category: "artifact",
        depends_on,
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "normalizedBriefPath", type: "path", required: false, description: "Path to normalized brief" }
        ],
        outputs: [
            { name: "artifactPath", type: "path", description: `Path to generated ${artifactType}` }
        ],
        tags: ["artifact", artifactType]
    };
    return {
        manifest,
        async execute(context, inputs) {
            const cwd = inputs.cwd ?? context.state.cwd;
            const normalizedBriefOverride = inputs.normalizedBriefPath ?? context.state.normalizedBriefPath;
            context.progress(1, 2, `Generating ${artifactType}...`);
            const filePath = await (0, artifacts_1.generateArtifact)({
                artifactType,
                cwd,
                normalizedBriefOverride,
                agent: context.agent
            });
            context.progress(2, 2, `${artifactType} generated.`);
            context.log(`${artifactType.toUpperCase()} generated: ${filePath}`);
            context.state.generatedArtifacts.set(artifactType, filePath);
            return { artifactPath: filePath };
        }
    };
}
