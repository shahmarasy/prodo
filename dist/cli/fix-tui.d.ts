import type { FixProposal, FixResult } from "../core/fix";
export declare function displayFixProposal(proposal: FixProposal, log: (message: string) => void): Promise<void>;
export declare function confirmFixExecution(proposal: FixProposal): Promise<boolean>;
export declare function displayFixResult(result: FixResult, log: (message: string) => void): Promise<void>;
