/**
 * Custom provider Chat API client — generic OpenAI-compatible endpoint.
 * @module
 */

import type {
  ChatModel,
  ChatRequest,
  ChatResult,
  ChatStreamResponse,
} from "../types";
import { parseSSEStream } from "../../utils/stream";
import { settings } from "../../settings";

/**
 * Available custom models — user can type any model name in settings.
 * These are just suggestions shown in the datalist.
 */
export const CUSTOM_MODELS: ChatModel[] = [
  { id: "gpt-4o", name: "GPT-4o (OpenAI)" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (OpenAI)" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "llama-3-70b", name: "Llama 3 70B" },
  { id: "qwen-2.5-72b", name: "Qwen 2.5 72B" },
];

/**
 * List available custom chat models.
 */
export async function listCustomModels(): Promise<ChatModel[]> {
  const modelId = settings.customChatModel || "custom-model";
  const models: ChatModel[] = [{ id: modelId, name: modelId }];
  // Also include suggestions for the dropdown
  for (const m of CUSTOM_MODELS) {
    if (m.id !== modelId) models.push(m);
  }
  return models;
}

/**
 * Send a chat message to the custom provider (OpenAI-compatible API).
 */
export async function customChat(
  messages: { role: string; content: string }[],
  options: { model: ChatModel; temperature?: number; signal?: AbortSignal },
  onProgress?: (content: string) => void
): Promise<ChatResult> {
  const apiKey = settings.customApiKey;
  if (!apiKey) throw new Error("Custom provider API key is not configured");

  const apiBase = settings.customApiBase.replace(/\/+$/, ""); // strip trailing slashes
  if (!apiBase)
    throw new Error("Custom provider API base URL is not configured");

  const url = `${apiBase}/chat/completions`;

  const requestMessages = messages.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  const request: ChatRequest = {
    model: options.model.id,
    messages: requestMessages,
    stream: true,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.model.maxOutputTokens ?? 4096,
  };

  const result: ChatResult = {
    content: "",
    finishReason: null,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Custom provider API error (${response.status}): ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  await parseSSEStream<ChatStreamResponse>(
    response.body,
    (parsedData) => {
      const contentDelta = parsedData.choices[0]?.delta?.content;
      const finishReason = parsedData.choices[0]?.finish_reason;

      if (contentDelta) {
        result.content += contentDelta;
        onProgress?.(contentDelta);
      }

      if (finishReason) {
        result.finishReason = finishReason;
      }
    },
    (error) => {
      console.error("Error parsing SSE from custom provider:", error);
    },
    options.signal
  );

  return result;
}
