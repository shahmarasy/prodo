import { generateArtifact } from "../core/artifacts";
import { defaultUpstreamByArtifact } from "../core/constants";
import type { Skill, SkillManifest } from "../skill-engine/types";

export function createArtifactSkill(artifactType: string, upstream?: string[]): Skill {
  const resolvedUpstream = upstream ?? defaultUpstreamByArtifact(artifactType);
  const depends_on = ["normalize", ...resolvedUpstream];

  const manifest: SkillManifest = {
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
      const cwd = (inputs.cwd as string) ?? context.state.cwd;
      const normalizedBriefOverride =
        (inputs.normalizedBriefPath as string) ?? context.state.normalizedBriefPath;

      context.progress(1, 2, `Generating ${artifactType}...`);

      const filePath = await generateArtifact({
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
