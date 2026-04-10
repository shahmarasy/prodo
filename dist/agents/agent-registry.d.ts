import type { AgentPlugin } from "./base";
import type { LLMProvider } from "../core/types";
export declare class AgentRegistry {
    private agents;
    register(agent: AgentPlugin): void;
    list(): AgentPlugin[];
    get(name: string): AgentPlugin | undefined;
    resolve(name?: string): Promise<AgentPlugin>;
    private resolveAgentName;
    toProvider(agent: AgentPlugin): LLMProvider;
}
export declare function getGlobalRegistry(): AgentRegistry;
export declare function resetGlobalRegistry(): void;
