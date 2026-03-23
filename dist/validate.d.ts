import type { ValidationIssue } from "./types";
export declare function runValidate(cwd: string, options: {
    strict?: boolean;
    report?: string;
}): Promise<{
    pass: boolean;
    reportPath: string;
    issues: ValidationIssue[];
}>;
