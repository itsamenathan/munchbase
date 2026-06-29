export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  const message = err instanceof Error ? err.message : String(err);
  // Stale cached clients (pre-server-action refactor) send Next-Action headers
  // that no longer match. This is transient noise, not an actionable error.
  if (message.includes("Failed to find Server Action")) return;
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      message: "Request error",
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      error: message,
      stack,
    }),
  );
}
