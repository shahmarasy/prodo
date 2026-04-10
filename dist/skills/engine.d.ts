import type { Skill, SkillContext, SkillManifest } from "./types";
export type SkillEngine = {
    register(skill: Skill): void;
    getSkill(name: string): Skill | undefined;
    listSkills(): SkillManifest[];
    execute(name: string, context: SkillContext, inputs: Record<string, unknown>): Promise<Record<string, unknown>>;
};
export declare function createSkillEngine(): SkillEngine;
export declare function getGlobalSkillEngine(): SkillEngine;
export declare function resetGlobalSkillEngine(): void;
