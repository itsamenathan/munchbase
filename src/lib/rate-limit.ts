interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= max) {
    throw new Error("Too many attempts. Try again later.");
  }
  entry.count++;
}
