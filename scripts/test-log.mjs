import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const loggerModule = new URL("../src/lib/logger.ts", import.meta.url).href;
const traceId = "0af7651916cd43dd8448eb211c80319c";
const spanId = "b7ad6b7169203331";

// pino writes straight to the process's stdout, so run the logger in a child and read what it printed.
function runLogger(body, env = {}) {
  const program = `
    import { context, trace } from "@opentelemetry/api";
    import { NodeSDK } from "@opentelemetry/sdk-node";
    import { logger } from ${JSON.stringify(loggerModule)};
    new NodeSDK().start(); // registers the context manager that makes a span "active"
    ${body}
  `;
  const result = spawnSync(process.execPath, ["--no-warnings", "--input-type=module", "-e", program], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, OTEL_TRACES_EXPORTER: "none", OTEL_LOGS_EXPORTER: "none", ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return { lines: result.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line)), stderr: result.stderr };
}

test("writes one JSON object per line with a readable level and ISO time", () => {
  const { lines } = runLogger(`logger.info("hello", { "app.key": "value" });`);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, "info");
  assert.equal(lines[0].msg, "hello");
  assert.equal(lines[0]["app.key"], "value");
  assert.match(lines[0].time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal("pid" in lines[0] || "hostname" in lines[0], false);
});

test("adds trace context only inside an active span", () => {
  const { lines } = runLogger(`
    logger.info("outside");
    const span = trace.wrapSpanContext({ traceId: "${traceId}", spanId: "${spanId}", traceFlags: 1 });
    context.with(trace.setSpan(context.active(), span), () => logger.info("inside"));
  `);
  const [outside, inside] = lines;
  assert.equal("trace_id" in outside, false);
  assert.equal(inside.trace_id, traceId);
  assert.equal(inside.span_id, spanId);
  assert.equal(inside.trace_flags, "01");
});

test("leaves out trace context when the active span has no valid IDs", () => {
  const { lines } = runLogger(`
    const span = trace.wrapSpanContext({ traceId: "00000000000000000000000000000000", spanId: "0000000000000000", traceFlags: 0 });
    context.with(trace.setSpan(context.active(), span), () => logger.info("invalid"));
  `);
  assert.equal("trace_id" in lines[0], false);
  assert.equal("span_id" in lines[0], false);
});

test("serializes errors and keeps every level on stdout", () => {
  const { lines, stderr } = runLogger(`
    logger.warn("careful", { err: new Error("soft") });
    logger.error("failed", { err: new TypeError("bad"), "http.route": "/x" });
    logger.error("odd", { error: "not an error object" });
  `);
  assert.equal(stderr, "");
  assert.deepEqual(lines.map((line) => line.level), ["warn", "error", "error"]);
  assert.equal(lines[1].err.type, "TypeError");
  assert.equal(lines[1].err.message, "bad");
  assert.match(lines[1].err.stack, /TypeError: bad/);
  assert.equal(lines[1]["http.route"], "/x");
  assert.equal(lines[2].error, "not an error object");
});

test("MUNCHBASE_LOG_LEVEL filters quieter messages", () => {
  const { lines } = runLogger(`logger.info("i"); logger.warn("w"); logger.error("e");`, { MUNCHBASE_LOG_LEVEL: "warn" });
  assert.deepEqual(lines.map((line) => line.msg), ["w", "e"]);
});

test("an unknown MUNCHBASE_LOG_LEVEL falls back to info instead of throwing", () => {
  const { lines } = runLogger(`logger.info("i");`, { MUNCHBASE_LOG_LEVEL: "warning" });
  assert.deepEqual(lines.map((line) => line.msg), ["i"]);
  const upper = runLogger(`logger.info("i"); logger.warn("w");`, { MUNCHBASE_LOG_LEVEL: "WARN" });
  assert.deepEqual(upper.lines.map((line) => line.msg), ["w"]);
});

test("writes trace_flags as two hex digits", () => {
  const { lines } = runLogger(`
    const span = trace.wrapSpanContext({ traceId: "${traceId}", spanId: "${spanId}", traceFlags: 0x11 });
    context.with(trace.setSpan(context.active(), span), () => logger.info("flags"));
  `);
  assert.equal(lines[0].trace_flags, "11");
});

test("emits SDK log records only when OTEL_LOGS_EXPORTER opts in", () => {
  // The SDK in the child keeps log export off; a stand-in provider records what the logger emits.
  const program = (exporter) => `
    logs.setGlobalLoggerProvider({ getLogger: () => ({ emit: (record) => process.stderr.write(JSON.stringify(record) + "\\n") }) });
    process.env.OTEL_LOGS_EXPORTER = "${exporter}";
    logger.error("failed", { err: new TypeError("bad"), "http.route": "/x", count: 2 });
  `;
  assert.equal(runLogger(`import("@opentelemetry/api").then(({ logs }) => { ${program("none")} });`).stderr, "");
  const { stderr } = runLogger(`import("@opentelemetry/api").then(({ logs }) => { ${program("otlp")} });`);
  const record = JSON.parse(stderr.trim());
  assert.equal(record.body, "failed");
  assert.equal(record.severityText, "ERROR");
  assert.equal(record.attributes["exception.type"], "TypeError");
  assert.equal(record.attributes["exception.message"], "bad");
  assert.equal(record.attributes["http.route"], "/x");
  assert.equal(record.attributes.count, 2);
});
