import type { Instrumentation } from "next";

// The NEXT_RUNTIME checks are written inline so webpack drops the Node-only imports (the OpenTelemetry
// SDK, pino, SQLite) from the Edge instrumentation bundle. webpackMode "eager" keeps those modules in
// the Node entry instead of a separate chunk, so the standalone file trace still finds the SDK.
export async function register() {
  // The imports must sit inside this block: webpack prunes a constant-false branch, not code after a return.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    // Start OpenTelemetry before anything else so the first requests and startup logs are captured.
    const { startOpenTelemetry } = await import(/* webpackMode: "eager" */ "./instrumentation.node");
    await startOpenTelemetry();
    // Apply pending migrations at startup. Next keeps serving 500s when register() throws, so exit
    // instead; startup.ts has already logged the failing stage.
    const { initializeDatabase } = await import(/* webpackMode: "eager" */ "@/lib/database/startup");
    try {
      initializeDatabase();
    } catch {
      process.exit(1);
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  // Stale cached clients (pre-server-action refactor) send Next-Action headers
  // that no longer match. This is transient noise, not an actionable error.
  if (message.includes("Failed to find Server Action")) return;
  const fields = {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  };
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import(/* webpackMode: "eager" */ "@/lib/logger");
    logger.error("Request error", { ...fields, err: error });
    return;
  }
  // Only reached on the Edge runtime, where pino cannot load. No route uses Edge today (the proxy
  // runs on Node), but keep the branch so pino never enters an Edge bundle.
  console.error(JSON.stringify({ level: "error", msg: "Request error", ...fields, error: message, stack: error instanceof Error ? error.stack : undefined }));
};
