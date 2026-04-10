import { BaseAgent, type AgentConfig } from "../base";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";
export declare class MockAgent extends BaseAgent {
    readonly name = "mock";
    readonly displayName = "Mock (Testing)";
    readonly sdkRequired: null;
    private readonly provider;
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
    isAvailable(): Promise<boolean>;
    getConfig(): AgentConfig;
}
