import type { ContractCoverage } from "./types";
export declare const PRODO_DIR = ".prodo";
export declare const DEFAULT_STATUS = "draft";
export declare function defaultOutputDir(artifactType: string): string;
export declare function defaultRequiredHeadings(artifactType: string): string[];
export declare function defaultUpstreamByArtifact(artifactType: string): string[];
export declare function defaultRequiredContractsByArtifact(artifactType: string): Array<keyof ContractCoverage>;
