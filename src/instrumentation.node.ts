import type { NodeSDK } from "@opentelemetry/sdk-node";
import { APP_VERSION } from "@/lib/version";

const state = globalThis as typeof globalThis & { __munchbaseOtel?: NodeSDK };

// Exporters are chosen by the standard OTEL_* variables (OTEL_EXPORTER_OTLP_ENDPOINT, _HEADERS,
// _PROTOCOL, OTEL_TRACES_EXPORTER, ...). Without an endpoint they would retry against localhost,
// so the SDK starts only when something would actually be exported. Empty values (for example
// from a compose file that passes every OTEL_* variable) count as unset.
export async function startOpenTelemetry() {
  if (state.__munchbaseOtel || process.env.OTEL_SDK_DISABLED === "true") return;
  const env = process.env;
  const exportsTraces = Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
  // Logs reach ClickStack from stdout through the host collector, so exporting them through the SDK
  // too would duplicate every line. That happens only when OTEL_LOGS_EXPORTER opts in.
  const logsOptIn = Boolean(env.OTEL_LOGS_EXPORTER) && env.OTEL_LOGS_EXPORTER !== "none";
  const exportsLogs = logsOptIn && Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT);
  if (!exportsTraces && !exportsLogs) return;

  if (!exportsLogs) env.OTEL_LOGS_EXPORTER = "none";
  if (!exportsTraces) env.OTEL_TRACES_EXPORTER = "none";
  env.OTEL_SERVICE_NAME ||= "munchbase";

  // webpackIgnore: the SDK pulls in gRPC exporters that the webpack server bundle cannot resolve
  // (they need Node built-ins), so Node loads the SDK at runtime instead.
  const [{ NodeSDK: Sdk }, { resourceFromAttributes }, { ATTR_SERVICE_VERSION }] = await Promise.all([
    import(/* webpackIgnore: true */ "@opentelemetry/sdk-node"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);
  const sdk = new Sdk({
    resource: resourceFromAttributes(APP_VERSION?.label ? { [ATTR_SERVICE_VERSION]: APP_VERSION.label } : {}),
  });
  sdk.start();
  state.__munchbaseOtel = sdk;
}
