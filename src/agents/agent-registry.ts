import type { AgentPlugin } from "./base";
import { UserError } from "../core/errors";
import type { LLMProvider } from "../core/types";
import { MockAgent } from "./mock";
import { OpenAIAgent } from "./openai";
import { AnthropicAgent } from "./anthropic";
import { GoogleAgent } from "./google";

const AGENT_ALIASES: Record<string, string> = {
  mock: "mock",
  openai: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  google: "google",
  gemini: "google"
};

export class AgentRegistry {
  private agents = new Map<string, AgentPlugin>();

  register(agent: AgentPlugin): void {
    this.agents.set(agent.name, agent);
  }

  list(): AgentPlugin[] {
    return Array.from(this.agents.values());
  }

  get(name: string): AgentPlugin | undefined {
    const normalized = AGENT_ALIASES[name.toLowerCase().trim()] ?? name.toLowerCase().trim();
    return this.agents.get(normalized);
  }

  async resolve(name?: string): Promise<AgentPlugin> {
    const agentName = this.resolveAgentName(name);
    const agent = this.get(agentName);

    if (!agent) {
      const available = this.list().map((a) => a.name).join(", ");
      throw new UserError(
        `Unknown agent: "${agentName}". Available agents: ${available}`
      );
    }

    return agent;
  }

  private resolveAgentName(override?: string): string {
    if (override) return override;

    const fromEnv = process.env.PRODO_AGENT;
    if (fromEnv) return fromEnv;

    const fromLegacy = process.env.PRODO_LLM_PROVIDER;
    if (fromLegacy) return fromLegacy;

    const isTest =
      process.env.NODE_ENV === "test" ||
      process.env.PRODO_TEST === "1";
    if (isTest) return "mock";

    return "mock";
  }

  toProvider(agent: AgentPlugin): LLMProvider {
    return {
      generate: (prompt, inputContext, schemaHint) =>
        agent.generate(prompt, inputContext, schemaHint)
    };
  }
}

let globalRegistry: AgentRegistry | null = null;

function createDefaultRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new MockAgent());
  registry.register(new OpenAIAgent());
  registry.register(new AnthropicAgent());
  registry.register(new GoogleAgent());
  return registry;
}

export function getGlobalRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry();
  }
  return globalRegistry;
}

export function resetGlobalRegistry(): void {
  globalRegistry = null;
}
