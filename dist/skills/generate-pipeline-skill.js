"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePipelineSkill = void 0;
const artifact_registry_1 = require("../core/artifact-registry");
const artifacts_1 = require("../core/artifacts");
const normalize_1 = require("../core/normalize");
const validate_1 = require("../core/validate");
exports.generatePipelineSkill = {
    manifest: {
        name: "generate-pipeline",
        description: "Run end-to-end pipeline: normalize → generate all artifacts → validate",
        category: "core",
        inputs: [
            { name: "cwd", type: "path", required: true, description: "Project working directory" },
            { name: "strict", type: "boolean", required: false, description: "Treat warnings as errors" }
        ],
        outputs: [
            { name: "pass", type: "string", description: "Whether validation passed" },
            { name: "reportPath", type: "path", description: "Path to validation report" },
            { name: "artifactCount", type: "string", description: "Number of artifacts generated" }
        ]
    },
    async execute(context, inputs) {
        const cwd = inputs.cwd ?? context.cwd;
        const normalizedPath = await (0, normalize_1.runNormalize)({ cwd });
        context.log(`Normalized brief: ${normalizedPath}`);
        const artifactTypes = await (0, artifact_registry_1.listArtifactTypes)(cwd);
        for (const type of artifactTypes) {
            const file = await (0, artifacts_1.generateArtifact)({
                artifactType: type,
                cwd,
                normalizedBriefOverride: normalizedPath,
                agent: context.agent
            });
            context.log(`${type.toUpperCase()} generated: ${file}`);
        }
        const result = await (0, validate_1.runValidate)(cwd, { strict: Boolean(inputs.strict) });
        context.log(`Validation ${result.pass ? "passed" : "failed"}: ${result.reportPath}`);
        return {
            pass: result.pass,
            reportPath: result.reportPath,
            artifactCount: artifactTypes.length
        };
    }
};
