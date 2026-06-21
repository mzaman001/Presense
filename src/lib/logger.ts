type LogLevel = "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

class Logger {
  private log(level: LogLevel, message: string, ...args: any[]) {
    // In production, we could send these to a service like Sentry or Datadog
    if (isProduction) {
      // Stub for production logging integration (e.g. Sentry.captureMessage)
      if (level === "error") {
        // We still might want to output errors to stderr in prod if running on server
        if (typeof window === "undefined") {
          console.error(`[${level.toUpperCase()}]`, message, ...args);
        }
      }
      return;
    }

    // In development, log to the console
    switch (level) {
      case "info":
        console.log(`[INFO] ${message}`, ...args);
        break;
      case "warn":
        console.warn(`[WARN] ${message}`, ...args);
        break;
      case "error":
        console.error(`[ERROR] ${message}`, ...args);
        break;
    }
  }

  info(message: string, ...args: any[]) {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log("error", message, ...args);
  }
}

export const logger = new Logger();
