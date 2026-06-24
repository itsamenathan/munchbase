export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  const message = err instanceof Error ? err.message : String(err);
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
