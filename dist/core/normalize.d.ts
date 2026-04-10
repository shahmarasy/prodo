type NormalizeOptions = {
    cwd: string;
    brief?: string;
    out?: string;
    additionalContext?: Record<string, string>;
};
export declare function runNormalize(options: NormalizeOptions): Promise<string>;
export {};
