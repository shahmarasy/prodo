import type { ContractCoverage } from "./types";
export type ArtifactConfig = {
    name: string;
    output_dir?: string;
    required_headings?: string[];
    upstream?: string[];
    required_contracts?: Array<keyof ContractCoverage>;
};
export type ProdoProjectConfig = {
    presets?: string[];
    artifacts?: ArtifactConfig[];
    command_packs?: string[];
};
export declare function readProjectConfig(cwd: string): Promise<ProdoProjectConfig>;
