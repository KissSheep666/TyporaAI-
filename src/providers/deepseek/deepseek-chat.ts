/**
 * DeepSeek Chat API client — OpenAI-compatible endpoint.
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
 * System prompts for DeepSeek — adapted from Copilot prompts.
 */
const CODE_BLOCK_FORMAT_INSTRUCTION = `
In your responses, always format code blocks using ~~~ triple tildes (not backticks) with the following rules:
1. Always specify a language identifier after the opening tildes (e.g. ~~~javascript). If no language is specified, use "plaintext" as the default.
2. Always close code blocks with three tildes on their own line (~~~)
3. Never use backtick code blocks (\`\`\`) as they cause rendering issues when code contains nested code blocks
4. Example of proper format:
   ~~~python
   def hello_world():
       print("Hello, world!")
   ~~~
`;

export const DEEPSEEK_MARKDOWN_INSTRUCTIONS = `
You are a helpful AI assistant specializing in Markdown document editing, academic writing, content creation, and knowledge sharing.
The user is working in Typora, a Markdown editor.
Provide helpful responses that may be about:
- Improving their current document
- Answering knowledge questions related to their document's content
- Explaining concepts mentioned in their document
- General assistance with writing and research
- Creative suggestions for content development

You should maintain a natural, conversational tone while being informative and helpful.

# YOUR CAPABILITIES
- Fix grammatical errors and improve writing clarity
- Suggest improvements to document structure and organization
- Help with formatting using Markdown syntax
- Provide content suggestions and expansions
- Answer questions about topics in the document
- Explain concepts, theories, or terminology mentioned in the document
- Create tables, lists, and other Markdown elements when requested
- Help with academic citations and references
- Assist with creating technical documentation
- Engage in conversational discussions about document-related topics

# INTERACTION GUIDELINES
When suggesting edits, use standard Markdown formatting.
When answering knowledge questions, be informative but concise.
When explaining concepts from the document, refer to specific sections when relevant.
When the user asks general questions not directly about editing the document, still provide helpful answers.
${CODE_BLOCK_FORMAT_INSTRUCTION}
`;

export const DEEPSEEK_ACADEMIC_INSTRUCTIONS = `
You are a helpful AI assistant specializing in academic writing and research.
The user is working in Typora, a Markdown editor.

# YOUR CAPABILITIES
- Structure academic papers according to field-specific conventions
- Format citations and references in APA, MLA, Chicago, IEEE and other styles
- Create cohesive literature reviews that synthesize research
- Develop clear research questions and hypotheses
- Design appropriate methodology sections
- Analyze and present research results clearly
- Write effective abstracts, introductions and conclusions
- Create properly formatted tables, figures and appendices
- Improve academic tone, clarity and precision of language
- Help with grant proposals and academic presentations
- Suggest appropriate academic terminology and phrasing
- Identify gaps in research arguments and suggest improvements

# INTERACTION GUIDELINES
When discussing academic topics, maintain scholarly rigor and acknowledge limitations.
When suggesting citations, provide properly formatted examples in the appropriate style.
When helping with research questions, ensure they are specific, measurable, and aligned with the methodology.
When reviewing academic writing, focus on clarity, precision, and logical flow of arguments.
${CODE_BLOCK_FORMAT_INSTRUCTION}

Remember that academic integrity is paramount - always emphasize the importance of proper attribution.
`;

/**
 * Available DeepSeek models.
 * These are the models confirmed available on the user's DeepSeek platform account.
 */
export const DEEPSEEK_MODELS: ChatModel[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Fast)" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro (Powerful)" },
];

/**
 * List available DeepSeek chat models.
 */
export async function listDeepSeekModels(): Promise<ChatModel[]> {
  return DEEPSEEK_MODELS;
}

/**
 * Send a chat message to DeepSeek Chat API (OpenAI-compatible).
 * @param messages Array of messages to send
 * @param options Chat options
 * @param onProgress Optional callback for streaming responses
 * @returns The chat result
 */
export async function deepseekChat(
  messages: { role: string; content: string }[],
  options: { model: ChatModel; temperature?: number; signal?: AbortSignal },
  onProgress?: (content: string) => void
): Promise<ChatResult> {
  const apiKey = settings.deepseekApiKey;
  if (!apiKey) throw new Error("DeepSeek API key is not configured");

  const url = "https://api.deepseek.com/chat/completions";

  // Older reasoner model doesn't support system messages — skip for models with "reasoner" in id
  const isReasoner = options.model.id.includes("reasoner");

  const requestMessages = isReasoner
    ? messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
    : messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

  const request: ChatRequest = {
    model: options.model.id,
    messages: requestMessages,
    stream: true,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.model.maxOutputTokens,
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
    throw new Error(`DeepSeek API error (${response.status}): ${errorBody}`);
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
      console.error("Error parsing SSE from DeepSeek:", error);
    },
    options.signal
  );

  return result;
}
