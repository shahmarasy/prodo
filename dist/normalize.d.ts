type NormalizeOptions = {
    cwd: string;
    brief?: string;
    out?: string;
};
export declare function runNormalize(options: NormalizeOptions): Promise<string>;
export {};
