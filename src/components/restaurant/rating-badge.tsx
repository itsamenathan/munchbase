import { RATING_ICON_MAP, RATING_PRESETS, repeatedIcon, type RatingDefinition } from "./rating-common";
import { DollarSign, Star, Undo2, X, Tag } from "lucide-react";

export function RatingBadge({ definition, value }: { definition: RatingDefinition; value: string }) {
  if (definition.presetKey === "go_back") {
    if (value === "true") {
      return (
        <span className="entry-rating-badge icon-badge positive" aria-label="Go back" title="Go back">
          <Undo2 size={14} />
        </span>
      );
    }
    return (
      <span className="entry-rating-badge icon-badge negative" aria-label="Would not go back" title="Would not go back">
        <X size={14} />
      </span>
    );
  }
  if (definition.presetKey === "price") {
    return (
      <span className="entry-rating-badge price icon-badge" aria-label={`Price: ${value.length} dollar signs`} title={`Price: ${value}`}>
        {repeatedIcon(DollarSign, value.length, 13)}
      </span>
    );
  }
  if (definition.presetKey === "stars") {
    return (
      <span className="entry-rating-badge stars icon-badge" aria-label={`${value} stars`} title={`${value} stars`}>
        {repeatedIcon(Star, Number(value), 13, true)}
      </span>
    );
  }

  const presetIcon = definition.presetKey ? RATING_PRESETS.find((p) => p.key === definition.presetKey)?.icon : null;
  const icon = (presetIcon ?? definition.icon) || "tag";
  const displayValue = value === "true" ? "Yes" : value === "false" ? "No" : value;
  return (
    <span className="entry-rating-badge">
      {RATING_ICON_MAP[icon] ?? <Tag size={14} />}
      {definition.name}: {displayValue}
    </span>
  );
}
