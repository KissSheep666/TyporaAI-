/**
 * Provider types for AI backend abstraction.
 * Shared types used by both Copilot and DeepSeek providers.
 * @module
 */

import type {
  Completion,
  CompletionOptions,
  CompletionResult,
} from "../client/client";

/**
 * Supported AI provider types.
 */
export type ProviderType = "copilot" | "deepseek" | "custom";

// ============================================================
// Chat types (shared between Copilot and DeepSeek chat APIs)
// Moved here from client/chat.ts to avoid circular dependencies
// ============================================================

export interface ChatModel {
  id: string;
  name: string;
  tokenizer?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface ChatOptions {
  model: ChatModel;
  /** @default 0.1 */
  temperature?: number;
}

export interface ChatRequest {
  model: string;
  /** Chat context. */
  messages: { role: string; content: string }[];
  /** Number of responses to generate. */
  n?: number;
  /** Top-p sampling. */
  top_p?: number;
  /** Whether to stream the response. */
  stream?: boolean;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  max_tokens?: number;
}

export interface ChatResponse {
  id?: string;
  object?: string;
  created?: number;
  choices?: {
    message?: {
      role?: string;
      content?: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
    done_reason?: string;
    index?: number;
  }[];
  usage?: {
    total_tokens?: number;
  };
  finish_reason?: string;
  done_reason?: string;
  copilot_references?: {
    metadata?: {
      display_name?: string;
      display_url?: string;
    };
  }[];
}

export interface ChatStreamResponse {
  id: string;
  object: string;
  created: number;
  choices: {
    index: number;
    delta?: {
      content?: string;
      role?: string;
    };
    finish_reason: null | string;
  }[];
}

export interface ChatResult {
  content: string;
  finishReason: string | null;
  totalTokens?: number;
  references?: {
    name: string;
    url: string;
  }[];
}

// ============================================================
// Provider interfaces
// ============================================================

/**
 * Chat provider interface — abstracts the chat backend.
 */
export interface ChatProvider {
  /** List available models. */
  listModels(): Promise<ChatModel[]>;

  /** Send a chat request with streaming support. */
  chat(
    messages: { role: string; content: string }[],
    options: { model: ChatModel; temperature?: number; signal?: AbortSignal },
    onProgress?: (content: string) => void
  ): Promise<ChatResult>;
}

/**
 * Completion provider interface — abstracts inline completion backend.
 */
export interface CompletionProvider {
  /** Get completions for the current cursor position. */
  getCompletions(
    options: CompletionOptions,
    documentText: string
  ): Promise<CompletionResult>;

  /** Get cycling completions (alternative suggestions). May return empty. */
  getCompletionsCycling(options: CompletionOptions): Promise<CompletionResult>;

  /** Notify that a completion was shown to the user. */
  notifyShown?(completion: Completion): void;

  /** Notify that a completion was accepted. */
  notifyAccepted?(completion: Completion): void;

  /** Notify that completions were rejected. */
  notifyRejected?(completions: Completion[]): void;
}
