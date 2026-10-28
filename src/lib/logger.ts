import { isSpanContextValid, logs, SeverityNumber, trace } from "@opentelemetry/api";
import pino from "pino";

type Level = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

// An unknown level would make pino throw while this module loads, taking down every importer.
function logLevel() {
  const level = process.env.MUNCHBASE_LOG_LEVEL?.trim().toLowerCase();
  return level && level in pino.levels.values ? level : "info";
}

// One JSON object per line on stdout, which Docker and the host collector already pick up. Lines
// written inside a request carry the active span's IDs so they can be matched to its trace.
const pinoLogger = pino({
  level: logLevel(),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  mixin() {
    // A context with all-zero IDs (no SDK provider, or a non-recording span) would tie the line to no trace.
    const span = trace.getActiveSpan()?.spanContext();
    if (!span || !isSpanContextValid(span)) return {};
    return { trace_id: span.traceId, span_id: span.spanId, trace_flags: span.traceFlags.toString(16).padStart(2, "0") };
  },
});

const severity: Record<Level, SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

function exportsLogs() {
  const exporter = process.env.OTEL_LOGS_EXPORTER;
  return Boolean(exporter) && exporter !== "none";
}

// Log record attributes must be primitives; errors become the semantic-convention exception fields.
function attributes(context: LogContext) {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Error) {
      result["exception.type"] = value.name;
      result["exception.message"] = value.message;
      if (value.stack) result["exception.stacktrace"] = value.stack;
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else {
      result[key] = JSON.stringify(value);
    }
  }
  return result;
}

function write(level: Level, message: string, context: LogContext = {}) {
  pinoLogger[level](context, message);
  // Off by default (see instrumentation.node.ts): the collector already ships stdout, so exporting
  // the same lines through the SDK would store each of them twice.
  if (!exportsLogs() || !pinoLogger.isLevelEnabled(level)) return;
  logs.getLogger("munchbase").emit({
    severityNumber: severity[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: attributes(context),
  });
}

// Error objects under `err` are serialized with their type, message and stack by pino's default serializer.
export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
