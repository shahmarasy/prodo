import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
export declare function validateSchema(cwd: string, artifactType: ArtifactType, doc: ArtifactDoc, requiredHeadingsOverride?: string[]): Promise<{
    issues: ValidationIssue[];
    requiredHeadings: string[];
}>;
