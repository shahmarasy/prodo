import { runValidate } from "../core/validate";
import type { Skill } from "../skill-engine/types";

export function createValidateSkill(artifactTypes: string[]): Skill {
  return {
    manifest: {
      name: "validate",
      version: "2.0.0",
      description: "Run 7-gate cross-artifact validation and generate report",
      category: "validation",
      depends_on: [...artifactTypes],
      inputs: [
        { name: "cwd", type: "path", required: true, description: "Project working directory" }
      ],
      outputs: [
        { name: "validationResult", type: "json", description: "Validation result with pass/fail and issues" }
      ],
      tags: ["validation", "consistency"]
    },

    async execute(context, inputs) {
      const cwd = (inputs.cwd as string) ?? context.state.cwd;
      context.progress(1, 2, "Validating artifacts...");

      const result = await runValidate(cwd, {});

      context.progress(2, 2, `Validation ${result.pass ? "passed" : "failed"}.`);
      context.log(`Validation ${result.pass ? "passed" : "failed"}: ${result.reportPath}`);
      context.state.validationResult = result;

      return {
        validationResult: {
          pass: result.pass,
          reportPath: result.reportPath,
          issueCount: result.issues.length
        }
      };
    }
  };
}
