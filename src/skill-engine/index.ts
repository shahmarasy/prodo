import { SkillRegistry } from "./registry";
import { SkillPipeline } from "./pipeline";
import { discoverSkills } from "./discovery";
import { registerCoreSkills } from "../skills/register-core";
import { createPipelineState, hydrateStateFromDisk } from "./context";
import { listArtifactTypes } from "../core/artifact-registry";
import type { PipelineState } from "./types";

export async function createEngine(
  cwd: string,
  log?: (message: string) => void
): Promise<SkillPipeline> {
  const registry = new SkillRegistry();

  await registerCoreSkills(registry, cwd);

  const plugins = await discoverSkills(cwd, log);
  for (const plugin of plugins) {
    try {
      registry.register(plugin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.(`[Skill Engine] Plugin registration failed: ${message}`);
    }
  }

  return new SkillPipeline(registry);
}

export async function createHydratedState(cwd: string): Promise<PipelineState> {
  const state = createPipelineState(cwd);
  const artifactTypes = await listArtifactTypes(cwd);
  await hydrateStateFromDisk(cwd, state, artifactTypes);
  return state;
}

export { SkillPipeline } from "./pipeline";
export { SkillRegistry } from "./registry";
export { createPipelineState, hydrateStateFromDisk } from "./context";
export { buildExecutionPlan, detectCycles, getExecutionOrder } from "./graph";
export { discoverSkills } from "./discovery";
export { validateInputs, validateOutputs, validateInputPaths } from "./validator";
export type {
  Skill,
  SkillManifest,
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillExecuteFn,
  PipelineState,
  PipelineOptions,
  ExecutionTier,
  SkillError,
  ProgressCallback
} from "./types";
