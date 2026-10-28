import type { Instrumentation } from "next";
import { startOpenTelemetry } from "./instrumentation.node";

const serverRuntime = process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build";

export async function register() {
  if (!serverRuntime) return;
  // Start OpenTelemetry before anything else so the first requests and startup logs are captured.
  await startOpenTelemetry();
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
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    // Middleware runs on the Edge runtime, where pino cannot load. Write the same fields as one
    // JSON line so the error is still captured.
    console.error(JSON.stringify({ level: "error", msg: "Request error", ...fields, error: message, stack: error instanceof Error ? error.stack : undefined }));
    return;
  }
  const { logger } = await import("@/lib/logger");
  logger.error("Request error", { ...fields, err: error });
};
