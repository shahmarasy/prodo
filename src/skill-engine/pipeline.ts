import { UserError } from "../core/errors";
import { wireInputsFromState, wireOutputsToState } from "./context";
import { getExecutionOrder } from "./graph";
import type { SkillRegistry } from "./registry";
import type { PipelineOptions, PipelineState, SkillContext, SkillError } from "./types";
import { validateInputs, validateOutputs } from "./validator";

function createSkillError(
  skillName: string,
  phase: SkillError["phase"],
  error: unknown
): SkillError {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return {
    skillName,
    phase,
    message,
    stack,
    recoveryHints: [`Skill "${skillName}" failed during ${phase}. Check inputs and retry.`]
  };
}

export class SkillPipeline {
  constructor(private registry: SkillRegistry) {}

  async runPipeline(
    skillNames: string[],
    state: PipelineState,
    options: PipelineOptions = {}
  ): Promise<PipelineState> {
    const { log = console.log, progress, agent } = options;

    for (const name of skillNames) {
      if (!this.registry.has(name)) {
        const available = this.registry.list().map((s) => s.manifest.name).join(", ");
        throw new UserError(`Unknown skill: "${name}". Available: ${available}`);
      }
    }

    const manifests = new Map(
      this.registry.list().map((s) => [s.manifest.name, s.manifest])
    );
    const executionOrder = getExecutionOrder(manifests, skillNames);
    const totalSteps = executionOrder.length;

    for (let i = 0; i < executionOrder.length; i++) {
      const skillName = executionOrder[i];

      if (state.completedSkills.includes(skillName)) {
        log(`[Skip] ${skillName} — already completed`);
        continue;
      }

      const skill = this.registry.get(skillName);
      if (!skill) continue;

      progress?.(i + 1, totalSteps, `Running ${skillName}...`);
      log(`[${i + 1}/${totalSteps}] ${skillName}`);

      const inputNames = skill.manifest.inputs.map((inp) => inp.name);
      const wiredInputs = wireInputsFromState(inputNames, state);

      const inputError = validateInputs(skill.manifest, wiredInputs);
      if (inputError) {
        throw new UserError(
          `Skill "${skillName}" input validation failed: ${inputError.message}\n` +
          inputError.recoveryHints.join("\n")
        );
      }

      let outputs: Record<string, unknown>;
      try {
        const context: SkillContext = {
          state,
          progress: progress ?? (() => {}),
          log,
          agent
        };
        outputs = await skill.execute(context, wiredInputs);
      } catch (error) {
        const skillError = createSkillError(skillName, "execution", error);
        throw new UserError(
          `Skill "${skillName}" execution failed: ${skillError.message}\n` +
          skillError.recoveryHints.join("\n")
        );
      }

      const outputError = validateOutputs(skill.manifest, outputs);
      if (outputError) {
        log(`[Warning] Skill "${skillName}" output validation: ${outputError.message}`);
      }

      wireOutputsToState(outputs, state, skillName);
      state.completedSkills.push(skillName);
    }

    return state;
  }

  async runSkill(
    name: string,
    state: PipelineState,
    options: PipelineOptions = {}
  ): Promise<PipelineState> {
    return this.runPipeline([name], state, options);
  }

  getRegistry(): SkillRegistry {
    return this.registry;
  }
}
