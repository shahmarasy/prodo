export type ProdoSettings = {
    lang: string;
    ai?: string;
};
export declare function readSettings(cwd: string): Promise<ProdoSettings>;
export declare function writeSettings(cwd: string, settings: ProdoSettings): Promise<string>;
