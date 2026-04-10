import { listArtifactTypes } from "../core/artifact-registry";
import { generateArtifact } from "../core/artifacts";
import { runNormalize } from "../core/normalize";
import { runValidate } from "../core/validate";
import type { Skill } from "./types";

export const generatePipelineSkill: Skill = {
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

  async execute(context, inputs): Promise<Record<string, unknown>> {
    const cwd = (inputs.cwd as string) ?? context.cwd;

    const normalizedPath = await runNormalize({ cwd });
    context.log(`Normalized brief: ${normalizedPath}`);

    const artifactTypes = await listArtifactTypes(cwd);
    for (const type of artifactTypes) {
      const file = await generateArtifact({
        artifactType: type,
        cwd,
        normalizedBriefOverride: normalizedPath,
        agent: context.agent
      });
      context.log(`${type.toUpperCase()} generated: ${file}`);
    }

    const result = await runValidate(cwd, { strict: Boolean(inputs.strict) });
    context.log(`Validation ${result.pass ? "passed" : "failed"}: ${result.reportPath}`);

    return {
      pass: result.pass,
      reportPath: result.reportPath,
      artifactCount: artifactTypes.length
    };
  }
};
