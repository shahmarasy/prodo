export declare function ensureDir(dirPath: string): Promise<void>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function readJsonFile<T>(filePath: string): Promise<T>;
export declare function timestampSlug(date?: Date): string;
export declare function listFilesSortedByMtime(dirPath: string): Promise<string[]>;
export declare function isPathInside(parentDir: string, candidatePath: string): boolean;
