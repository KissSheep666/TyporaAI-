/**
 * Custom provider completion — inline ghost-text completions.
 *
 * Uses the custom provider's OpenAI-compatible Chat API with a simple
 * "continue writing" prompt, since most third-party APIs don't support FIM.
 * @module
 */

import type {
  Completion,
  CompletionOptions,
  CompletionResult,
} from "../../client/client";
import { settings } from "../../settings";
import { generateUUID } from "../../utils/random";

const MAX_BEFORE_CHARS = 2000;
const MAX_AFTER_CHARS = 500;

function trimContext(text: string, maxChars: number, fromEnd: boolean): string {
  if (text.length <= maxChars) return text;
  const lines = text.split("\n");
  if (fromEnd) {
    let accumulated = 0;
    const kept: string[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineLen = lines[i]!.length + (kept.length > 0 ? 1 : 0);
      if (accumulated + lineLen > maxChars && kept.length > 0) break;
      kept.unshift(lines[i]!);
      accumulated += lineLen;
    }
    return kept.join("\n");
  } else {
    let accumulated = 0;
    const kept: string[] = [];
    for (const line of lines) {
      const lineLen = line.length + (kept.length > 0 ? 1 : 0);
      if (accumulated + lineLen > maxChars && kept.length > 0) break;
      kept.push(line);
      accumulated += lineLen;
    }
    return kept.join("\n");
  }
}

export async function getCustomCompletions(
  options: CompletionOptions,
  documentText: string,
  signal?: AbortSignal
): Promise<CompletionResult> {
  const apiKey = settings.customApiKey;
  if (!apiKey) throw new Error("Custom provider API key is not configured");

  const apiBase = settings.customApiBase.replace(/\/+$/, "");
  if (!apiBase)
    throw new Error("Custom provider API base URL is not configured");

  const model =
    settings.customCompletionModel || settings.customChatModel || "gpt-4o";

  const { position } = options;
  const lines = documentText.split("\n");

  const beforeLines = lines.slice(0, position.line);
  const currentLineBefore =
    lines[position.line]?.slice(0, position.character) ?? "";
  const prompt = [...beforeLines, currentLineBefore].join("\n");

  const currentLineAfter =
    lines[position.line]?.slice(position.character) ?? "";
  const afterLines = lines.slice(position.line + 1);
  const suffix = [currentLineAfter, ...afterLines].join("\n");

  if (prompt.length === 0 && suffix.length === 0) {
    return { completions: [] };
  }

  const contextBefore = trimContext(prompt, MAX_BEFORE_CHARS, true);
  const contextAfter = trimContext(suffix, MAX_AFTER_CHARS, false);

  // Simple "continue writing" prompt — works with any Chat model
  const messages = [
    {
      role: "system" as const,
      content:
        "You are an inline text completion engine. Continue writing EXACTLY where the [CURSOR] marker is. " +
        "Output ONLY the next few words — no explanation, no greeting, no markdown. " +
        "Keep it short (1-10 words). If nothing makes sense, output nothing.",
    },
    {
      role: "user" as const,
      content: `${contextBefore}[CURSOR]${contextAfter}\n\nContinue at [CURSOR]:`,
    },
  ];

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: settings.completionMaxTokens,
      temperature: settings.completionTemperature,
      stream: false,
      stop: ["\n\n", "。", ". ", "\n-", "\n#"],
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Custom provider completion error (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  let text = data.choices?.[0]?.message?.content ?? "";

  if (!text || text.trim().length === 0) {
    return { completions: [] };
  }

  text = text.trim();

  if (!text) return { completions: [] };

  const completion: Completion = {
    uuid: generateUUID(),
    position,
    range: { start: position, end: position },
    text,
    displayText: text,
    docVersion: 0,
  };

  return { completions: [completion] };
}

export async function getCustomCompletionsCycling(
  _options: CompletionOptions
): Promise<CompletionResult> {
  return { completions: [], cancellationReason: "cycling not supported" };
}
