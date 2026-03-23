import type { ArtifactType } from "./types";
export type GenerateOptions = {
    artifactType: ArtifactType;
    cwd: string;
    normalizedBriefOverride?: string;
    outPath?: string;
    agent?: string;
};
export declare function generateArtifact(options: GenerateOptions): Promise<string>;
