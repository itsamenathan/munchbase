/**
 * Monogram avatars for Restaurants and Lists that have no photo. The hue is
 * derived from the name so a Restaurant keeps the same color everywhere.
 */
export function avatarHue(name: string): number {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }
  return hash;
}

/** First letter of the first word that starts with a letter or digit. */
export function monogram(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "?";
}
