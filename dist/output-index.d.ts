import type { ArtifactType } from "./types";
type ArtifactMap = Partial<Record<ArtifactType, string>>;
type ArtifactHistoryMap = Partial<Record<ArtifactType, string[]>>;
export type OutputIndex = {
    active: ArtifactMap;
    history: ArtifactHistoryMap;
    updated_at: string;
};
export declare function loadOutputIndex(cwd: string): Promise<OutputIndex>;
export declare function saveOutputIndex(cwd: string, index: OutputIndex): Promise<void>;
export declare function setActiveArtifact(cwd: string, type: ArtifactType, filePath: string): Promise<void>;
export declare function getActiveArtifactPath(cwd: string, type: ArtifactType): Promise<string | undefined>;
export {};
