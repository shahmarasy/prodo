import { type NormalizedBrief } from "./normalized-brief";
import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
type LoadedArtifact = {
    type: ArtifactType;
    file: string;
    doc: ArtifactDoc;
};
export type TraceEntry = {
    contractId: string;
    contractText: string;
    category: "goals" | "core_features" | "constraints";
    references: Array<{
        artifactType: ArtifactType;
        file: string;
        line: string;
    }>;
};
export type TraceMap = Map<string, TraceEntry>;
export declare function buildTraceMap(normalizedBrief: NormalizedBrief, loadedArtifacts: LoadedArtifact[]): TraceMap;
export declare function checkRequirementCompleteness(traceMap: TraceMap, normalizedBrief: NormalizedBrief, presentArtifactTypes: ArtifactType[]): ValidationIssue[];
export {};
