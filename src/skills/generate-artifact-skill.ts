import { generateArtifact } from "../core/artifacts";
import type { Skill } from "./types";

export const generateArtifactSkill: Skill = {
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

  async execute(context, inputs): Promise<Record<string, unknown>> {
    const cwd = (inputs.cwd as string) ?? context.cwd;
    const filePath = await generateArtifact({
      artifactType: inputs.artifactType as string,
      cwd,
      normalizedBriefOverride: inputs.from as string | undefined,
      outPath: inputs.out as string | undefined,
      agent: context.agent
    });
    context.log(`${(inputs.artifactType as string).toUpperCase()} generated: ${filePath}`);
    return { filePath };
  }
};
