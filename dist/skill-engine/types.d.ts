import type { ValidationIssue } from "../core/types";
export type SkillInputType = "string" | "path" | "boolean" | "json" | "number";
export type SkillInput = {
    name: string;
    type: SkillInputType;
    required: boolean;
    description?: string;
    default?: unknown;
};
export type SkillOutput = {
    name: string;
    type: SkillInputType;
    description?: string;
};
export type SkillManifest = {
    name: string;
    version: string;
    description: string;
    category: "core" | "artifact" | "validation" | "custom";
    depends_on: string[];
    inputs: SkillInput[];
    outputs: SkillOutput[];
    tags?: string[];
};
export type PipelineState = {
    cwd: string;
    normalizedBriefPath?: string;
    generatedArtifacts: Map<string, string>;
    validationResult?: {
        pass: boolean;
        reportPath: string;
        issues: ValidationIssue[];
    };
    custom: Record<string, unknown>;
    startedAt: string;
    completedSkills: string[];
};
export type ProgressCallback = (step: number, total: number, message: string) => void;
export type SkillContext = {
    state: PipelineState;
    progress: ProgressCallback;
    log: (message: string) => void;
    agent?: string;
};
export type SkillExecuteFn = (context: SkillContext, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
export type Skill = {
    manifest: SkillManifest;
    execute: SkillExecuteFn;
};
export type SkillError = {
    skillName: string;
    phase: "input_validation" | "execution" | "output_validation";
    message: string;
    inputContext?: Record<string, unknown>;
    stack?: string;
    recoveryHints: string[];
};
export type ExecutionTier = {
    tier: number;
    skills: string[];
};
export type PipelineOptions = {
    log?: (message: string) => void;
    progress?: ProgressCallback;
    agent?: string;
};
