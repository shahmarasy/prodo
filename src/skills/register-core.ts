import { listArtifactDefinitions } from "../core/artifact-registry";
import type { SkillRegistry } from "../skill-engine/registry";
import { createArtifactSkill } from "./generate-artifact";
import { fixSkill } from "./fix";
import { normalizeSkill } from "./normalize";
import { createValidateSkill } from "./validate";

export async function registerCoreSkills(
  registry: SkillRegistry,
  cwd: string
): Promise<void> {
  registry.register(normalizeSkill);

  const definitions = await listArtifactDefinitions(cwd);
  const artifactNames: string[] = [];

  for (const def of definitions) {
    const skill = createArtifactSkill(def.name, def.upstream);
    registry.register(skill);
    artifactNames.push(def.name);
  }

  const validateSkill = createValidateSkill(artifactNames);
  registry.register(validateSkill);

  registry.register(fixSkill);
}
