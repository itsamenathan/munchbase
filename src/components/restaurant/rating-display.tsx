import { RatingBadge } from "./rating-badge";
import { RATING_ICON_MAP, RATING_PRESETS, type RatingDefinition } from "./rating-common";
import type { Restaurant } from "@/lib/types";
import { Tag } from "lucide-react";

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
  const activeGroups = groups
    .map((g) => ({ ...g, definitions: g.definitions.filter((d) => d.active) }))
    .filter((g) => g.definitions.length);
  if (!activeGroups.length) return <p className="muted">No attributes enabled.</p>;
  return (
    <div className="markdown-sections">
      {activeGroups.map((g) => (
        <section key={g.list.id} className="markdown-section">
          <h5>{g.list.name}</h5>
          <div className="rating-summary">
            {g.definitions.map((d) => {
              const value = entry.ratings.find((r) => r.definitionId === d.id)?.value ?? "";
              return value ? (
                <RatingBadge key={d.id} definition={d} value={value} />
              ) : (
                <span key={d.id} className="entry-rating-badge">
                  {RATING_ICON_MAP[(d.presetKey ? RATING_PRESETS.find((p) => p.key === d.presetKey)?.icon : d.icon) || "tag"] ?? <Tag size={14} />}
                  {d.name}: Unset
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
