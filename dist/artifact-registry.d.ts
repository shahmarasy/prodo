import type { ArtifactType, ContractCoverage } from "./types";
export type ArtifactDefinition = {
    name: ArtifactType;
    output_dir: string;
    required_headings: string[];
    upstream: ArtifactType[];
    required_contracts: Array<keyof ContractCoverage>;
};
export declare function listArtifactDefinitions(cwd: string): Promise<ArtifactDefinition[]>;
export declare function listArtifactTypes(cwd: string): Promise<ArtifactType[]>;
export declare function getArtifactDefinition(cwd: string, artifactType: string): Promise<ArtifactDefinition>;
