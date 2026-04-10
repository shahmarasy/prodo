import { runNormalize } from "../core/normalize";
import type { Skill } from "./types";

export const normalizeSkill: Skill = {
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

  async execute(context, inputs): Promise<Record<string, unknown>> {
    const cwd = (inputs.cwd as string) ?? context.cwd;
    const outPath = await runNormalize({
      cwd,
      brief: inputs.brief as string | undefined,
      out: inputs.out as string | undefined
    });
    context.log(`Normalized brief written to: ${outPath}`);
    return { normalizedBriefPath: outPath };
  }
};
