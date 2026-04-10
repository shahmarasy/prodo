import type { ProviderSchemaHint } from "../core/types";
export declare function buildSystemPrompt(schemaHint: ProviderSchemaHint, outputLanguage: string): string;
export declare function buildUserMessage(prompt: string, inputContext: Record<string, unknown>): string;
