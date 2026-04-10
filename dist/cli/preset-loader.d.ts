export declare function applyConfiguredPresets(projectRoot: string, prodoRoot: string, prodoVersion: string, presetOverride?: string): Promise<{
    installedPresets: string[];
    appliedFiles: string[];
}>;
