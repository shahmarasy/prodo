import { BaseAgent, type AgentConfig } from "../base";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";
export declare class GoogleAgent extends BaseAgent {
    readonly name = "google";
    readonly displayName = "Google Gemini";
    readonly sdkRequired = "@google/generative-ai";
    getConfig(): AgentConfig;
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
}
