import { UserError } from "../core/errors";
import type { Skill, SkillContext, SkillManifest } from "./types";

export type SkillEngine = {
  register(skill: Skill): void;
  getSkill(name: string): Skill | undefined;
  listSkills(): SkillManifest[];
  execute(name: string, context: SkillContext, inputs: Record<string, unknown>): Promise<Record<string, unknown>>;
};

function validateInputs(skill: Skill, inputs: Record<string, unknown>): void {
  for (const input of skill.manifest.inputs) {
    if (input.required && !(input.name in inputs)) {
      throw new UserError(
        `Skill "${skill.manifest.name}" requires input "${input.name}" (${input.description})`
      );
    }
  }
}

export function createSkillEngine(): SkillEngine {
  const skills = new Map<string, Skill>();

  return {
    register(skill: Skill): void {
      skills.set(skill.manifest.name, skill);
    },

    getSkill(name: string): Skill | undefined {
      return skills.get(name);
    },

    listSkills(): SkillManifest[] {
      return Array.from(skills.values()).map((s) => s.manifest);
    },

    async execute(
      name: string,
      context: SkillContext,
      inputs: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
      const skill = skills.get(name);
      if (!skill) {
        const available = Array.from(skills.keys()).join(", ");
        throw new UserError(`Unknown skill: "${name}". Available: ${available}`);
      }

      validateInputs(skill, inputs);
      return skill.execute(context, inputs);
    }
  };
}

let globalEngine: SkillEngine | null = null;

export function getGlobalSkillEngine(): SkillEngine {
  if (!globalEngine) {
    globalEngine = createSkillEngine();
    loadBuiltinSkills(globalEngine);
  }
  return globalEngine;
}

export function resetGlobalSkillEngine(): void {
  globalEngine = null;
}

function loadBuiltinSkills(engine: SkillEngine): void {
  // Lazy-load to avoid circular dependencies
  try {
    const { normalizeSkill } = require("./normalize-skill") as { normalizeSkill: Skill };
    engine.register(normalizeSkill);
  } catch { /* skill not available */ }

  try {
    const { validateSkill } = require("./validate-skill") as { validateSkill: Skill };
    engine.register(validateSkill);
  } catch { /* skill not available */ }

  try {
    const { fixSkill } = require("./fix-skill") as { fixSkill: Skill };
    engine.register(fixSkill);
  } catch { /* skill not available */ }

  try {
    const { generateArtifactSkill } = require("./generate-artifact-skill") as { generateArtifactSkill: Skill };
    engine.register(generateArtifactSkill);
  } catch { /* skill not available */ }

  try {
    const { generatePipelineSkill } = require("./generate-pipeline-skill") as { generatePipelineSkill: Skill };
    engine.register(generatePipelineSkill);
  } catch { /* skill not available */ }
}
