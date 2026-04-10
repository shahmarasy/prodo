import { BaseAgent, type AgentConfig } from "../base";
import { buildSystemPrompt, buildUserMessage } from "../system-prompts";
import { UserError } from "../../core/errors";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

type ContentBlock = { type: string; text?: string };

export class AnthropicAgent extends BaseAgent {
  readonly name = "anthropic";
  readonly displayName = "Anthropic Claude";
  readonly sdkRequired = "@anthropic-ai/sdk";

  getConfig(): AgentConfig {
    return {
      name: this.name,
      displayName: this.displayName,
      sdkRequired: this.sdkRequired,
      envVars: ["ANTHROPIC_API_KEY"],
      defaultModel: "claude-sonnet-4-20250514"
    };
  }

  async generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new UserError("ANTHROPIC_API_KEY is not set. Set it to use the Anthropic agent.");
    }

    const model = process.env.PRODO_ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

    const outputLanguage =
      typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
        ? inputContext.outputLanguage.trim()
        : "en";

    const system = buildSystemPrompt(schemaHint, outputLanguage);
    const user = buildUserMessage(prompt, inputContext);

    let AnthropicConstructor: new (opts: { apiKey: string }) => {
      messages: {
        create: (params: Record<string, unknown>) => Promise<{
          content: ContentBlock[];
        }>;
      };
    };

    try {
      const mod = (await dynamicImport("@anthropic-ai/sdk")) as {
        default: typeof AnthropicConstructor;
      };
      AnthropicConstructor = mod.default;
    } catch {
      throw new UserError(
        "Anthropic SDK is not installed. Run: npm install @anthropic-ai/sdk"
      );
    }

    const client = new AnthropicConstructor({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }]
    });

    const textBlock = response.content.find(
      (block: ContentBlock) => block.type === "text"
    );
    const content = textBlock?.text?.trim() ?? "";

    if (!content) {
      throw new UserError("Anthropic agent returned an empty response.");
    }

    return { body: content };
  }
}
