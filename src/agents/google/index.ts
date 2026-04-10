import { BaseAgent, type AgentConfig } from "../base";
import { buildSystemPrompt, buildUserMessage } from "../system-prompts";
import { UserError } from "../../core/errors";
import type { GenerateResult, ProviderSchemaHint } from "../../core/types";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

export class GoogleAgent extends BaseAgent {
  readonly name = "google";
  readonly displayName = "Google Gemini";
  readonly sdkRequired = "@google/generative-ai";

  getConfig(): AgentConfig {
    return {
      name: this.name,
      displayName: this.displayName,
      sdkRequired: this.sdkRequired,
      envVars: ["GOOGLE_API_KEY"],
      defaultModel: "gemini-2.0-flash"
    };
  }

  async generate(
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<GenerateResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new UserError("GOOGLE_API_KEY is not set. Set it to use the Google Gemini agent.");
    }

    const model = process.env.PRODO_GOOGLE_MODEL ?? "gemini-2.0-flash";

    const outputLanguage =
      typeof inputContext.outputLanguage === "string" && inputContext.outputLanguage.trim()
        ? inputContext.outputLanguage.trim()
        : "en";

    const system = buildSystemPrompt(schemaHint, outputLanguage);
    const user = buildUserMessage(prompt, inputContext);

    let GoogleGenerativeAI: new (apiKey: string) => {
      getGenerativeModel: (config: { model: string; systemInstruction: string }) => {
        generateContent: (content: string) => Promise<{
          response: { text: () => string };
        }>;
      };
    };

    try {
      const mod = (await dynamicImport("@google/generative-ai")) as {
        GoogleGenerativeAI: typeof GoogleGenerativeAI;
      };
      GoogleGenerativeAI = mod.GoogleGenerativeAI;
    } catch {
      throw new UserError(
        "Google Generative AI SDK is not installed. Run: npm install @google/generative-ai"
      );
    }

    const client = new GoogleGenerativeAI(apiKey);
    const generativeModel = client.getGenerativeModel({
      model,
      systemInstruction: system
    });

    const result = await generativeModel.generateContent(user);
    const content = result.response.text().trim();

    if (!content) {
      throw new UserError("Google Gemini agent returned an empty response.");
    }

    return { body: content };
  }
}
