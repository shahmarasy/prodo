import type { ArtifactType } from "./types";
export type GenerateOptions = {
    artifactType: ArtifactType;
    cwd: string;
    normalizedBriefOverride?: string;
    outPath?: string;
    agent?: string;
    revisionType?: "default" | "fix";
};
export declare function generateArtifact(options: GenerateOptions): Promise<string>;
