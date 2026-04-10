import type { GenerateResult, ProviderSchemaHint } from "../core/types";

export type AgentConfig = {
  name: string;
  displayName: string;
  sdkRequired: string | null;
  envVars: string[];
  defaultModel?: string;
};

export interface AgentPlugin {
  readonly name: string;
  readonly displayName: string;
  readonly sdkRequired: string | null;

  generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult>;

  isAvailable(): Promise<boolean>;
  getConfig(): AgentConfig;
}

export abstract class BaseAgent implements AgentPlugin {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly sdkRequired: string | null;

  abstract generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult>;

  abstract getConfig(): AgentConfig;

  async isAvailable(): Promise<boolean> {
    const config = this.getConfig();

    if (config.sdkRequired) {
      try {
        await import(config.sdkRequired);
      } catch {
        return false;
      }
    }

    for (const envVar of config.envVars) {
      if (!process.env[envVar]) {
        return false;
      }
    }

    return true;
  }

  availabilityHint(): string {
    const config = this.getConfig();
    const hints: string[] = [];

    if (config.sdkRequired) {
      hints.push(`SDK required: npm install ${config.sdkRequired}`);
    }

    for (const envVar of config.envVars) {
      if (!process.env[envVar]) {
        hints.push(`Set environment variable: ${envVar}`);
      }
    }

    return hints.length > 0
      ? `Agent "${config.displayName}" is not available.\n  ${hints.join("\n  ")}`
      : `Agent "${config.displayName}" is available.`;
  }
}
