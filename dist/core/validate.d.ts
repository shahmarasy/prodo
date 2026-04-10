import type { ValidationIssue } from "./types";
export type ValidateResult = {
    pass: boolean;
    reportPath: string;
    issues: ValidationIssue[];
};
export declare function runValidate(cwd: string, options: {
    strict?: boolean;
    report?: string;
}): Promise<ValidateResult>;
