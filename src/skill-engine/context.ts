import { normalizedBriefPath } from "../core/paths";
import { getActiveArtifactPath } from "../core/output-index";
import { fileExists } from "../core/utils";
import type { ArtifactType } from "../core/types";
import type { PipelineState } from "./types";

export function createPipelineState(cwd: string): PipelineState {
  return {
    cwd,
    normalizedBriefPath: undefined,
    generatedArtifacts: new Map(),
    validationResult: undefined,
    custom: {},
    startedAt: new Date().toISOString(),
    completedSkills: []
  };
}

export async function hydrateStateFromDisk(
  cwd: string,
  state: PipelineState,
  artifactTypes: ArtifactType[]
): Promise<void> {
  const nbPath = normalizedBriefPath(cwd);
  if (!state.normalizedBriefPath && (await fileExists(nbPath))) {
    state.normalizedBriefPath = nbPath;
  }

  for (const type of artifactTypes) {
    if (!state.generatedArtifacts.has(type)) {
      const active = await getActiveArtifactPath(cwd, type);
      if (active) {
        state.generatedArtifacts.set(type, active);
      }
    }
  }
}

export function isOutputSatisfied(
  outputName: string,
  state: PipelineState,
  artifactType?: string
): boolean {
  if (outputName === "normalizedBriefPath") {
    return typeof state.normalizedBriefPath === "string" && state.normalizedBriefPath.length > 0;
  }
  if (outputName === "artifactPath" && artifactType) {
    return state.generatedArtifacts.has(artifactType);
  }
  if (outputName === "validationResult") {
    return state.validationResult !== undefined;
  }
  return false;
}

export function wireInputsFromState(
  inputNames: string[],
  state: PipelineState
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const name of inputNames) {
    if (name === "cwd") inputs.cwd = state.cwd;
    else if (name === "normalizedBriefPath") inputs.normalizedBriefPath = state.normalizedBriefPath;
    else if (name in state.custom) inputs[name] = state.custom[name];
  }
  return inputs;
}

export function wireOutputsToState(
  outputs: Record<string, unknown>,
  state: PipelineState,
  skillName: string
): void {
  if ("normalizedBriefPath" in outputs && typeof outputs.normalizedBriefPath === "string") {
    state.normalizedBriefPath = outputs.normalizedBriefPath;
  }
  if ("artifactPath" in outputs && typeof outputs.artifactPath === "string") {
    const artifactType = skillName;
    state.generatedArtifacts.set(artifactType, outputs.artifactPath);
  }
  if ("validationResult" in outputs && outputs.validationResult && typeof outputs.validationResult === "object") {
    state.validationResult = outputs.validationResult as PipelineState["validationResult"];
  }

  for (const [key, value] of Object.entries(outputs)) {
    if (!["normalizedBriefPath", "artifactPath", "validationResult"].includes(key)) {
      state.custom[key] = value;
    }
  }
}
