import { createLogger } from "./utils/logging";

/**
 * Logger used across the plugin.
 */
export const logger = createLogger({
  prefix: `%cAI plugin:%c `,
  styles: ["font-weight: bold", "font-weight: normal"],
});
