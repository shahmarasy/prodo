import type { ExecutionTier, SkillManifest } from "./types";
export declare function detectCycles(manifests: Map<string, SkillManifest>): string[][] | null;
export declare function buildExecutionPlan(manifests: Map<string, SkillManifest>, targetSkills: string[]): ExecutionTier[];
export declare function getExecutionOrder(manifests: Map<string, SkillManifest>, targetSkills: string[]): string[];
