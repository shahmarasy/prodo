import { BaseAgent, type AgentConfig } from "../base";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";
export declare class AnthropicAgent extends BaseAgent {
    readonly name = "anthropic";
    readonly displayName = "Anthropic Claude";
    readonly sdkRequired = "@anthropic-ai/sdk";
    getConfig(): AgentConfig;
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<GenerateResult>;
}
