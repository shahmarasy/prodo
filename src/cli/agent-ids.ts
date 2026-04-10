import { UserError } from "../core/errors";

export const AGENT_IDS = ["codex", "gemini-cli", "claude-cli"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export function isSupportedAgent(agent?: string): agent is AgentId {
  if (!agent) return false;
  return AGENT_IDS.includes(agent as AgentId);
}

export function resolveAgent(agent?: string): AgentId | undefined {
  if (!agent) return undefined;
  if (!isSupportedAgent(agent)) {
    throw new UserError(`Unsupported agent: ${agent}. Supported: ${AGENT_IDS.join(", ")}`);
  }
  return agent;
}

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

export async function loadAgentCommandSet(_cwd: string, agent: AgentId): Promise<AgentCommandSet> {
  const prefix = "/prodo";
  return {
    agent,
    description: "Agent-specific command set for Prodo artifact pipeline.",
    recommended_sequence: [
      { command: "prodo init . --ai <agent> --lang <en|tr>", purpose: "Initialize Prodo scaffold and agent commands." },
      { command: `${prefix}-normalize`, purpose: "Normalize start brief into normalized brief JSON." },
      { command: `${prefix}-prd`, purpose: "Generate PRD artifact." },
      { command: `${prefix}-workflow`, purpose: "Generate workflow artifact." },
      { command: `${prefix}-wireframe`, purpose: "Generate wireframe artifact." },
      { command: `${prefix}-stories`, purpose: "Generate stories artifact." },
      { command: `${prefix}-techspec`, purpose: "Generate techspec artifact." },
      { command: `${prefix}-validate`, purpose: "Run validation report." },
      { command: `${prefix}-fix`, purpose: "Fix artifacts when validation fails." }
    ],
    artifact_shortcuts: {
      normalize: `${prefix}-normalize`,
      prd: `${prefix}-prd`,
      workflow: `${prefix}-workflow`,
      wireframe: `${prefix}-wireframe`,
      stories: `${prefix}-stories`,
      techspec: `${prefix}-techspec`,
      validate: `${prefix}-validate`,
      fix: `${prefix}-fix`
    }
  };
}
