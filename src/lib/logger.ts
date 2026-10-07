import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const pinoLogger = pino({
  level: isProduction ? "info" : "debug",
  browser: {
    asObject: true,
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    env: process.env.NODE_ENV,
  },
});

/**
 * The log fields for a call's extra arguments. pino writes an Error inside
 * an array as {}, so `logger.error("label", err)` used to reach the server
 * logs as "args":[{}], with no message or stack. The first Error goes under
 * `err`, which pino's error serializer expands.
 */
export function logFields(args: unknown[]): { err?: Error; args?: unknown[] } {
  const index = args.findIndex((a) => a instanceof Error);
  if (index === -1) return { args };
  const rest = args.filter((_, i) => i !== index);
  return {
    err: args[index] as Error,
    ...(rest.length > 0 ? { args: rest } : {}),
  };
}

export const logger = {
  info: (message: string, ...args: unknown[]) =>
    pinoLogger.info(logFields(args), message),
  warn: (message: string, ...args: unknown[]) =>
    pinoLogger.warn(logFields(args), message),
  error: (message: string, ...args: unknown[]) =>
    pinoLogger.error(logFields(args), message),
};
