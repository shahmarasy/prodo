import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
type LoadedArtifact = {
    type: ArtifactType;
    file: string;
    doc: ArtifactDoc;
};
export declare function checkConsistency(cwd: string, loadedArtifacts: LoadedArtifact[], normalizedBrief: Record<string, unknown>): Promise<ValidationIssue[]>;
export {};
