/**
 * Canonical form for golden-master comparison.
 *
 * SQLite drivers disagree on two shapes without disagreeing on meaning: a query
 * that matches no row yields `undefined` on better-sqlite3 and `null` on
 * bun:sqlite, and column order decides key order. Both are normalized here so a
 * driver swap does not produce spurious diffs. Everything else — values, types,
 * row counts, ordering within arrays — is preserved exactly, so a genuine change
 * in what the database returns still fails the comparison.
 *
 * Types are encoded rather than coerced: a `1` that becomes `"1"` or `1n` shows
 * up as a diff instead of silently matching.
 */
export function canonical(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return { __bigint: value.toString() };
  if (value instanceof Uint8Array) return { __bytes: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonical(source[key])]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}
