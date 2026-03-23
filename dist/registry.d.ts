export type OverrideRegistryEntry = {
    artifact_type: string;
    file: string;
    sha256: string;
};
export type ProdoRegistry = {
    schema_version: "1.0";
    updated_at: string;
    installed_presets: string[];
    installed_overrides: OverrideRegistryEntry[];
};
export declare function readRegistry(cwd: string): Promise<ProdoRegistry>;
export declare function syncRegistry(cwd: string): Promise<ProdoRegistry>;
