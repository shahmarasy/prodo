import type { GenerateResult, ProviderSchemaHint } from "../core/types";
export type AgentConfig = {
    name: string;
    displayName: string;
    sdkRequired: string | null;
    envVars: string[];
    defaultModel?: string;
};
export interface AgentPlugin {
    readonly name: string;
    readonly displayName: string;
    readonly sdkRequired: string | null;
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
    isAvailable(): Promise<boolean>;
    getConfig(): AgentConfig;
}
export declare abstract class BaseAgent implements AgentPlugin {
    abstract readonly name: string;
    abstract readonly displayName: string;
    abstract readonly sdkRequired: string | null;
    abstract generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
    abstract getConfig(): AgentConfig;
    isAvailable(): Promise<boolean>;
    availabilityHint(): string;
}
