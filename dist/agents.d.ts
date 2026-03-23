export declare const AGENT_IDS: readonly ["codex", "gemini-cli", "claude-cli"];
export type AgentId = (typeof AGENT_IDS)[number];
export declare function isSupportedAgent(agent?: string): agent is AgentId;
export declare function resolveAgent(agent?: string): AgentId | undefined;
export type CommandSetItem = {
    command: string;
    purpose: string;
};
export type AgentCommandSet = {
    agent: string;
    description?: string;
    recommended_sequence?: CommandSetItem[];
    artifact_shortcuts?: Record<string, string>;
};
export declare function loadAgentCommandSet(_cwd: string, agent: AgentId): Promise<AgentCommandSet>;
