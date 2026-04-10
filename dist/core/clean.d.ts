export type CleanOptions = {
    cwd: string;
    dryRun?: boolean;
    log?: (message: string) => void;
};
export type CleanResult = {
    removedPaths: string[];
    preservedPaths: string[];
};
export declare function runClean(options: CleanOptions): Promise<CleanResult>;
