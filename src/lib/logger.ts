type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  process.stderr.write(
    JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...context }) + "\n",
  );
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
