import type { LLMProvider, ProviderSchemaHint } from "../types";
export declare class OpenAIProvider implements LLMProvider {
    private readonly apiKey;
    private readonly model;
    private readonly baseUrl;
    constructor();
    generate(prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<{
        body: string;
        frontmatter?: Record<string, unknown>;
    }>;
}
