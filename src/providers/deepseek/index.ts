/**
 * DeepSeek provider — barrel export.
 * @module
 */

export {
  deepseekChat,
  listDeepSeekModels,
  DEEPSEEK_MARKDOWN_INSTRUCTIONS,
  DEEPSEEK_ACADEMIC_INSTRUCTIONS,
  DEEPSEEK_MODELS,
} from "./deepseek-chat";

export {
  getDeepSeekCompletions,
  getDeepSeekCompletionsCycling,
} from "./deepseek-completion";
