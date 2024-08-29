import { createOpenAI, openai } from "@ai-sdk/openai";
import { CoreMessage, CoreTool, generateObject, LanguageModel } from "ai";
import { ollama } from "ollama-ai-provider";
import { z } from "zod";

const schema = z.object({
  store_section: z.array(
    z.object({
      name: z.string(),
      items: z.array(z.string()),
    })
  ),
});

export interface Context {
  model: string;
  messages: CoreMessage[];
  systemPrompt: string;
  tools?: Record<string, CoreTool<any, any>>;
}

export function startContext(model: string, systemPrompt: string): Context {
  const ctx: Context = {
    model,
    systemPrompt,
    messages: [],
  };
  return ctx;
}

export function addMessage(ctx: Context, message: string) {
  ctx.messages.push({
    role: "user",
    content: message,
  });
}

export function modelFromString(modelString: string): LanguageModel {
  const [provider, model] = modelString.split("/");
  if (provider === "ollama") {
    return ollama(model);
  } else if (provider === "openai") {
    return openai(model);
  } else if (provider === "groq") {
    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      // apiKey: process.env.GROQ_API_KEY,
    });

    return groq(model);
  }
  throw new Error(`Unknown model provider: ${provider}`);
}

export async function processContext(ctx: Context) {
  return await generateObject({
    model: modelFromString(ctx.model),
    // tools: ctx.tools,
    system: ctx.systemPrompt,
    messages: ctx.messages,
    schema: schema,
  });
}
