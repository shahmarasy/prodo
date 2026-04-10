export declare const AI_ALIASES: Record<string, "codex" | "gemini-cli" | "claude-cli">;
export type SupportedAi = "codex" | "gemini-cli" | "claude-cli";
export declare function resolveAi(ai?: string): SupportedAi | undefined;
export declare function installAgentCommands(projectRoot: string, ai: SupportedAi, lang?: string): Promise<string[]>;
