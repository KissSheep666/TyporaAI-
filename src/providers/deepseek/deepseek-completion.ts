/**
 * DeepSeek completion provider — inline ghost-text completions.
 *
 * Uses the DeepSeek FIM (Fill-In-the-Middle) API at `/beta/completions`,
 * which is purpose-built for code/text completions with much lower latency
 * than the Chat API.
 * @module
 */

import type {
  Completion,
  CompletionOptions,
  CompletionResult,
} from "../../client/client";
import { settings } from "../../settings";
import { generateUUID } from "../../utils/random";

/**
 * Maximum context size (in characters) for before/after cursor.
 * FIM prompt/suffix can be larger since there's no chat message overhead.
 */
const MAX_BEFORE_CHARS = 2000;
const MAX_AFTER_CHARS = 500;

/**
 * Trim text to stay under `maxChars` while preserving line boundaries.
 */
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

/** Stop sequences that signal the model to end the completion. */
const STOP_WORDS = ["\n\n", "。", ". ", "\n-", "\n#", "\n*"];

/** Response shape for FIM API streaming chunks. */
interface FimStreamChunk {
  choices?: { text?: string; index?: number; finish_reason?: string | null }[];
}

/**
 * Get completions from DeepSeek FIM API.
 *
 * @param options - Completion options with cursor position.
 * @param documentText - Full document text.
 * @param signal - Optional AbortSignal to cancel the HTTP request.
 */
export async function getDeepSeekCompletions(
  options: CompletionOptions,
  documentText: string,
  signal?: AbortSignal
): Promise<CompletionResult> {
  const apiKey = settings.deepseekApiKey;
  if (!apiKey) throw new Error("DeepSeek API key is not configured");

  const { position } = options;
  const lines = documentText.split("\n");

  // --- Extract context around cursor ---
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

  // --- Trim context preserving line boundaries ---
  const promptTrimmed = trimContext(prompt, MAX_BEFORE_CHARS, true);
  const suffixTrimmed = trimContext(suffix, MAX_AFTER_CHARS, false);

  // FIM currently requires deepseek-v4-pro
  const model = "deepseek-v4-pro";

  // --- Call FIM API ---
  const response = await fetch("https://api.deepseek.com/beta/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: promptTrimmed,
      suffix: suffixTrimmed,
      max_tokens: settings.completionMaxTokens,
      temperature: settings.completionTemperature,
      stream: false,
      stop: STOP_WORDS,
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`DeepSeek FIM error (${response.status}): ${errorBody}`);
  }

  // FIM non-streaming response: { choices: [{ text: "..." }] }
  const data = (await response.json()) as FimStreamChunk;

  let text = data.choices?.[0]?.text ?? "";

  if (!text || text.trim().length === 0) {
    return { completions: [] };
  }

  // --- Strip trailing stop-word fragments ---
  for (const stop of STOP_WORDS) {
    const idx = text.indexOf(stop);
    if (idx !== -1) text = text.slice(0, idx);
  }
  text = text.trim();

  if (!text) {
    return { completions: [] };
  }

  // --- Wrap as Copilot-compatible Completion ---
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

/**
 * Cycling completions — not supported by DeepSeek.
 */
export async function getDeepSeekCompletionsCycling(
  _options: CompletionOptions
): Promise<CompletionResult> {
  return { completions: [], cancellationReason: "cycling not supported" };
}
