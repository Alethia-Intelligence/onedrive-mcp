/**
 * In MCP stdio transport, stdout is reserved for JSON-RPC messages.
 * ALL logging MUST go to stderr.
 */
export const logger = {
  info: (...args: unknown[]) => {
    console.error("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    console.error("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.error("[DEBUG]", ...args);
    }
  },
};
