export const NOTE_SECTION_PRESETS = [
  { key: "notes", name: "Notes", placeholder: "Anything else worth remembering" },
  { key: "what_to_order", name: "What to order", placeholder: "Dishes, drinks, specials worth getting" },
  { key: "what_to_avoid", name: "What to avoid", placeholder: "Things to skip" },
  { key: "people", name: "People", placeholder: "Date night, groups, quick lunch…" },
] as const;

const SECTION_MARKER_RE = /<!--section:(\d+)-->\n?/g;

export function parseNotes(notes: string | null): Record<number, string> {
  const result: Record<number, string> = {};
  if (!notes) return result;
  const matches = [...notes.matchAll(SECTION_MARKER_RE)];
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : notes.length;
    const content = notes.slice(start, end).replace(/\s+$/, "");
    if (content) result[Number(m[1])] = content;
  });
  return result;
}

// Merges `updates` (only ids present in the submitted form) over whatever
// was already stored, so sections hidden by an inactive toggle keep their content.
export function buildNotes(existingNotes: string | null, updates: Record<number, string>): string | null {
  const merged = { ...parseNotes(existingNotes), ...updates };
  const parts = Object.entries(merged)
    .map(([id, value]) => [id, value.trim()] as const)
    .filter(([, value]) => value)
    .map(([id, value]) => `<!--section:${id}-->\n${value}`);
  return parts.length ? parts.join("\n\n") : null;
}
