import type { LLMProvider, ProviderSchemaHint } from "../core/types";
export declare class MockProvider implements LLMProvider {
    generate(_prompt: string, inputContext: Record<string, unknown>, schemaHint: ProviderSchemaHint): Promise<{
        body: string;
        frontmatter?: Record<string, unknown>;
    }>;
}
