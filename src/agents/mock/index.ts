import { BaseAgent, type AgentConfig } from "../base";
import { MockProvider } from "../../providers/mock-provider";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";

export class MockAgent extends BaseAgent {
  readonly name = "mock";
  readonly displayName = "Mock (Testing)";
  readonly sdkRequired = null;

  private readonly provider = new MockProvider();

  async generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult> {
    return this.provider.generate(prompt, inputContext, schemaHint);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getConfig(): AgentConfig {
    return {
      name: this.name,
      displayName: this.displayName,
      sdkRequired: null,
      envVars: []
    };
  }
}
