import type { LLMProvider } from "../core/types";
import { getGlobalRegistry } from "../agents/agent-registry";

let cachedProvider: LLMProvider | null = null;
let cachedAgentName: string | null = null;

export function createProvider(): LLMProvider {
  const agentName =
    process.env.PRODO_AGENT ??
    process.env.PRODO_LLM_PROVIDER ??
    "mock";

  if (cachedProvider && cachedAgentName === agentName) {
    return cachedProvider;
  }

  const registry = getGlobalRegistry();
  const agent = registry.get(agentName);
  if (!agent) {
    const available = registry.list().map((a) => a.name).join(", ");
    throw new Error(`Unknown agent: "${agentName}". Available: ${available}`);
  }

  cachedProvider = registry.toProvider(agent);
  cachedAgentName = agentName;
  return cachedProvider;
}

export { getGlobalRegistry } from "../agents/agent-registry";
