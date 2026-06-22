import { RatingBadge } from "./rating-badge";
import type { RatingDefinition } from "./rating-common";
import type { Restaurant } from "@/lib/types";

export function RatingSummary({ entry, definitions }: { entry: Restaurant; definitions: RatingDefinition[] }) {
  const badges = definitions
    .map((d) => {
      const value = entry.ratings.find((r) => r.definitionId === d.id)?.value ?? "";
      if (!value) return null;
      return <RatingBadge key={d.id} definition={d} value={value} />;
    })
    .filter(Boolean);

  if (!badges.length) return <span className="rating-summary empty">No ratings yet</span>;
  return <div className="rating-summary">{badges}</div>;
}

export function AttributePreview({ entry, groups }: { entry: Restaurant; groups: Restaurant["ratingGroups"] }) {
  const ratedGroups = groups
    .map((g) => ({
      ...g,
      definitions: g.definitions.filter((d) => d.active && entry.ratings.find((r) => r.definitionId === d.id)?.value),
    }))
    .filter((g) => g.definitions.length);
  if (!ratedGroups.length) return <p className="muted">Not rated yet.</p>;
  return (
    <div className="markdown-sections">
      {ratedGroups.map((g) => (
        <section key={g.list.id} className="markdown-section">
          <h5>{g.list.name}</h5>
          <div className="rating-summary">
            {g.definitions.map((d) => {
              const value = entry.ratings.find((r) => r.definitionId === d.id)!.value;
              return <RatingBadge key={d.id} definition={d} value={value} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
