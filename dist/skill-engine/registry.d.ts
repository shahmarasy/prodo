import type { Skill, SkillManifest } from "./types";
export declare class SkillRegistry {
    private skills;
    register(skill: Skill): void;
    get(name: string): Skill | undefined;
    has(name: string): boolean;
    list(): Skill[];
    listByCategory(category: string): Skill[];
    listManifests(): SkillManifest[];
    unregister(name: string): boolean;
    size(): number;
}
