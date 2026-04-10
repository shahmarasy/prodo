import { BaseAgent, type AgentConfig } from "../base";
import { buildSystemPrompt, buildUserMessage } from "../system-prompts";
import { UserError } from "../../core/errors";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

export class OpenAIAgent extends BaseAgent {
  readonly name = "openai";
  readonly displayName = "OpenAI";
  readonly sdkRequired = "openai";

  getConfig(): AgentConfig {
    return {
      name: this.name,
      displayName: this.displayName,
      sdkRequired: this.sdkRequired,
      envVars: ["OPENAI_API_KEY"],
      defaultModel: "gpt-4o-mini"
    };
  }

  async generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new UserError("OPENAI_API_KEY is not set. Set it to use the OpenAI agent.");
    }

    const model = process.env.PRODO_OPENAI_MODEL ?? "gpt-4o-mini";
    const baseURL = process.env.PRODO_OPENAI_BASE_URL ?? undefined;

    const outputLanguage =
      typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
        ? inputContext.outputLanguage.trim()
        : "en";

    const system = buildSystemPrompt(schemaHint, outputLanguage);
    const user = buildUserMessage(prompt, inputContext);

    let OpenAIConstructor: new (opts: { apiKey: string; baseURL?: string }) => {
      chat: {
        completions: {
          create: (params: Record<string, unknown>) => Promise<{
            choices: Array<{ message?: { content?: string } }>;
          }>;
        };
      };
    };

    try {
      const mod = (await dynamicImport("openai")) as { default: typeof OpenAIConstructor };
      OpenAIConstructor = mod.default;
    } catch {
      throw new UserError(
        "OpenAI SDK is not installed. Run: npm install openai"
      );
    }

    const client = new OpenAIConstructor({ apiKey, baseURL });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new UserError("OpenAI agent returned an empty response.");
    }

    return { body: content };
  }
}
