import { BaseAgent, type AgentConfig } from "../base";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";
export declare class OpenAIAgent extends BaseAgent {
    readonly name = "openai";
    readonly displayName = "OpenAI";
    readonly sdkRequired = "openai";
    getConfig(): AgentConfig;
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
}
