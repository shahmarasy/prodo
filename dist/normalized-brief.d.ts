import type { ValidationIssue } from "./types";
export type BriefContractItem = {
    id: string;
    text: string;
};
export type NormalizedBrief = {
    schema_version: string;
    product_name: string;
    problem: string;
    audience: string[];
    goals: string[];
    core_features: string[];
    constraints: string[];
    assumptions: string[];
    contracts: {
        goals: BriefContractItem[];
        core_features: BriefContractItem[];
        constraints: BriefContractItem[];
    };
    confidence?: Record<string, number>;
};
type BriefContracts = NormalizedBrief["contracts"];
export declare function buildContractsFromArrays(input: {
    goals: string[];
    core_features: string[];
    constraints: string[];
}): BriefContracts;
export declare function parseNormalizedBrief(input: Record<string, unknown>): {
    brief: NormalizedBrief;
    issues: ValidationIssue[];
};
export declare function parseNormalizedBriefOrThrow(input: Record<string, unknown>): NormalizedBrief;
export declare function requireConfidenceOrThrow(brief: NormalizedBrief, fields: Array<keyof Pick<NormalizedBrief, "product_name" | "problem" | "audience" | "goals" | "core_features">>, threshold?: number): void;
export declare function contractIds(contracts: BriefContracts): {
    goals: string[];
    core_features: string[];
    constraints: string[];
};
export {};
