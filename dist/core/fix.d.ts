import type { ArtifactType, ValidationIssue } from "./types";
import { type ValidateResult } from "./validate";
export type FixProposal = {
    targets: ArtifactType[];
    issues: ValidationIssue[];
    issuesByArtifact: Map<ArtifactType, ValidationIssue[]>;
    initialReport: ValidateResult;
};
export type FixOptions = {
    cwd: string;
    agent?: string;
    strict?: boolean;
    report?: string;
    dryRun?: boolean;
    log?: (message: string) => void;
};
export type FixResult = {
    proposal: FixProposal;
    applied: boolean;
    finalPass: boolean;
    reportPath: string;
    backupDir?: string;
};
export declare function resolveFixTargets(cwd: string, artifactTypes: ArtifactType[], issues: Array<{
    artifactType?: ArtifactType;
}>): Promise<ArtifactType[]>;
export declare function buildFixProposal(options: FixOptions): Promise<FixProposal>;
export declare function createBackup(cwd: string, targets: ArtifactType[]): Promise<string>;
export declare function restoreBackup(cwd: string, backupDir: string): Promise<void>;
export declare function applyFix(cwd: string, proposal: FixProposal, options: FixOptions): Promise<FixResult>;
export declare function runFix(options: FixOptions): Promise<FixResult>;
