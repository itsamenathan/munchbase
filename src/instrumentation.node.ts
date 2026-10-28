import type { NodeSDK } from "@opentelemetry/sdk-node";
import { APP_VERSION } from "@/lib/version";

// Exporters are chosen by the standard OTEL_* variables (OTEL_EXPORTER_OTLP_ENDPOINT, _HEADERS,
// _PROTOCOL, OTEL_TRACES_EXPORTER, ...). Without an endpoint they would retry against localhost,
// so stay off instead.
const endpointVariables = [
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
  "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
];
const state = globalThis as typeof globalThis & { __munchbaseOtel?: NodeSDK };

export async function startOpenTelemetry() {
  if (state.__munchbaseOtel || process.env.OTEL_SDK_DISABLED === "true") return;
  if (!endpointVariables.some((name) => process.env[name])) return;

  // Logs reach ClickStack from stdout through the host collector, so exporting them here too would
  // duplicate every line. Set OTEL_LOGS_EXPORTER=otlp to export them through the SDK instead.
  // An empty value (for example from a compose file that passes every OTEL_* variable) counts as unset.
  process.env.OTEL_LOGS_EXPORTER ||= "none";
  // A logs endpoint alone should not send spans to the SDK's localhost default.
  if (!process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    process.env.OTEL_TRACES_EXPORTER ||= "none";
  }
  process.env.OTEL_SERVICE_NAME ||= "munchbase";

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
