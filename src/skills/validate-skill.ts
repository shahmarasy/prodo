import { runValidate } from "../core/validate";
import type { Skill } from "./types";

export const validateSkill: Skill = {
  manifest: {
    name: "validate",
    description: "Run cross-artifact validation and generate a report",
    category: "validation",
    inputs: [
      { name: "cwd", type: "path", required: true, description: "Project working directory" },
      { name: "strict", type: "boolean", required: false, description: "Treat warnings as errors" },
      { name: "report", type: "path", required: false, description: "Override report output path" }
    ],
    outputs: [
      { name: "pass", type: "string", description: "Whether validation passed" },
      { name: "reportPath", type: "path", description: "Path to validation report" }
    ]
  },

  async execute(context, inputs): Promise<Record<string, unknown>> {
    const cwd = (inputs.cwd as string) ?? context.cwd;
    const result = await runValidate(cwd, {
      strict: Boolean(inputs.strict),
      report: inputs.report as string | undefined
    });
    context.log(`Validation ${result.pass ? "passed" : "failed"}: ${result.reportPath}`);
    return { pass: result.pass, reportPath: result.reportPath, issueCount: result.issues.length };
  }
};
