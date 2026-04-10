import type { ArtifactType } from "../core/types";
import type { PipelineState } from "./types";
export declare function createPipelineState(cwd: string): PipelineState;
export declare function hydrateStateFromDisk(cwd: string, state: PipelineState, artifactTypes: ArtifactType[]): Promise<void>;
export declare function isOutputSatisfied(outputName: string, state: PipelineState, artifactType?: string): boolean;
export declare function wireInputsFromState(inputNames: string[], state: PipelineState): Record<string, unknown>;
export declare function wireOutputsToState(outputs: Record<string, unknown>, state: PipelineState, skillName: string): void;
