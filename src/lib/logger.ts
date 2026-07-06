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

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, ...args: any[]) => pinoLogger.info({ args }, message),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, ...args: any[]) => pinoLogger.warn({ args }, message),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, ...args: any[]) => pinoLogger.error({ args }, message),
};
