import type { SkillError, SkillManifest } from "./types";
export declare function validateInputs(manifest: SkillManifest, inputs: Record<string, unknown>): SkillError | null;
export declare function validateInputPaths(manifest: SkillManifest, inputs: Record<string, unknown>): Promise<SkillError | null>;
export declare function validateOutputs(manifest: SkillManifest, outputs: Record<string, unknown>): SkillError | null;
