import type { ArtifactType } from "./types";
type ResolveOptions = {
    cwd: string;
    artifactType: ArtifactType;
};
export declare function resolveTemplate(options: ResolveOptions): Promise<{
    path: string;
    content: string;
} | null>;
export declare function resolveCompanionTemplate(options: ResolveOptions): Promise<{
    path: string;
    content: string;
} | null>;
export declare function extractRequiredHeadingsFromTemplate(content: string): string[];
export {};
