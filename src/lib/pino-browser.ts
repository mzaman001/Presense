// What `import pino from "pino"` resolves to in the browser bundle (see
// turbopack.resolveAlias and the webpack alias in next.config.ts). The server
// keeps real pino.
//
// In the browser pino only ever wrote an object to the console, but pino
// 10.4's browser build grew to its own ~5 KiB chunk on /login (redaction and
// caller tracking we don't use). This keeps the same call shape and output
// for what src/lib/logger.ts uses: level filtering, `base` fields, the level
// formatter, and an (fields, message) call that logs one object.

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

type LevelName = keyof typeof LEVELS;
type Fields = Record<string, unknown>;

interface Options {
  level?: string;
  base?: Fields;
  formatters?: { level?: (label: string, number: number) => Fields };
  browser?: unknown;
}

type LogFn = (fields?: Fields | string, message?: string) => void;
export type BrowserLogger = Record<LevelName, LogFn>;

// trace and debug went to console.debug in pino's browser build.
const CONSOLE: Record<LevelName, "debug" | "info" | "warn" | "error"> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

export default function pino(options: Options = {}): BrowserLogger {
  const threshold =
    LEVELS[(options.level as LevelName) ?? "info"] ?? LEVELS.info;
  const levelField =
    options.formatters?.level ?? ((label: string) => ({ level: label }));
  const logger = {} as BrowserLogger;
  for (const name of Object.keys(LEVELS) as LevelName[]) {
    logger[name] = (fields, message) => {
      if (LEVELS[name] < threshold) return;
      const own = typeof fields === "string" ? {} : (fields ?? {});
      const msg = typeof fields === "string" ? fields : message;
      // Looked up per call, not as console.error(…) literals, so
      // compiler.removeConsole doesn't strip the browser's info/warn logs.
      console[CONSOLE[name]]({
        ...levelField(name, LEVELS[name]),
        time: Date.now(),
        ...options.base,
        ...own,
        ...(msg !== undefined ? { msg } : {}),
      });
    };
  }
  return logger;
}
