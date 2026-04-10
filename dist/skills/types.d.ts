export type SkillInput = {
    name: string;
    type: "path" | "string" | "boolean" | "json";
    required: boolean;
    description: string;
};
export type SkillOutput = {
    name: string;
    type: "path" | "string" | "json";
    description: string;
};
export type SkillManifest = {
    name: string;
    description: string;
    category: "core" | "artifact" | "validation" | "custom";
    inputs: SkillInput[];
    outputs: SkillOutput[];
};
export type SkillContext = {
    cwd: string;
    log: (message: string) => void;
    agent?: string;
};
export type SkillFunction = (context: SkillContext, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
export type Skill = {
    manifest: SkillManifest;
    execute: SkillFunction;
};
