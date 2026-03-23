import type { LLMProvider } from "../types";
import { MockProvider } from "./mock-provider";
import { OpenAIProvider } from "./openai-provider";

export function createProvider(): LLMProvider {
  const provider = (process.env.PRODO_LLM_PROVIDER ?? "mock").toLowerCase();
  if (provider === "openai") {
    return new OpenAIProvider();
  }
  return new MockProvider();
}

