import type { NormalizedBrief } from "./normalized-brief";
import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
type LoadedArtifact = {
    type: ArtifactType;
    file: string;
    doc: ArtifactDoc;
};
export type TermEntry = {
    term: string;
    normalizedTerm: string;
    definition?: string;
    sources: Array<{
        artifactType: ArtifactType | "brief";
        file: string;
        heading?: string;
    }>;
};
export type TermMap = Map<string, TermEntry>;
export declare function buildTermMap(normalizedBrief: NormalizedBrief, loadedArtifacts: LoadedArtifact[]): TermMap;
export declare function checkTermReconciliation(termMap: TermMap): ValidationIssue[];
export {};
