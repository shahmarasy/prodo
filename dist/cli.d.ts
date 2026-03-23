type RunOptions = {
    forcedCommand?: string;
    cwd?: string;
    argv?: string[];
    log?: (message: string) => void;
    error?: (message: string) => void;
};
export declare function runCli(options?: RunOptions): Promise<number>;
export {};
