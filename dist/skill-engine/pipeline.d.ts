import type { SkillRegistry } from "./registry";
import type { PipelineOptions, PipelineState } from "./types";
export declare class SkillPipeline {
    private registry;
    constructor(registry: SkillRegistry);
    runPipeline(skillNames: string[], state: PipelineState, options?: PipelineOptions): Promise<PipelineState>;
    runSkill(name: string, state: PipelineState, options?: PipelineOptions): Promise<PipelineState>;
    getRegistry(): SkillRegistry;
}
