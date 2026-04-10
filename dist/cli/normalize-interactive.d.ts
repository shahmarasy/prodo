export type InteractiveNormalizeOptions = {
    cwd: string;
    brief?: string;
    out?: string;
    maxIterations?: number;
    log?: (message: string) => void;
};
export declare function runInteractiveNormalize(options: InteractiveNormalizeOptions): Promise<string>;
