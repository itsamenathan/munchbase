import { isSpanContextValid, trace } from "@opentelemetry/api";
import pino from "pino";

type LogContext = Record<string, unknown>;

// One JSON object per line on stdout, which Docker and the host collector already pick up. Lines
// written inside a request carry the active span's IDs so they can be matched to its trace.
const pinoLogger = pino({
  level: process.env.MUNCHBASE_LOG_LEVEL || "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  mixin() {
    // A context with all-zero IDs (no SDK provider, or a non-recording span) would tie the line to no trace.
    const span = trace.getActiveSpan()?.spanContext();
    return span && isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId, trace_flags: `0${span.traceFlags.toString(16)}` } : {};
  },
});

// Error objects under `err` are serialized with their type, message and stack by pino's default serializer.
export const logger = {
  info: (message: string, context?: LogContext) => pinoLogger.info(context ?? {}, message),
  warn: (message: string, context?: LogContext) => pinoLogger.warn(context ?? {}, message),
  error: (message: string, context?: LogContext) => pinoLogger.error(context ?? {}, message),
};
