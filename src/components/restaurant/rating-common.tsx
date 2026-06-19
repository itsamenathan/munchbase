import { type ReactNode } from "react";
import {
  Award, Beer, CheckCircle, Cloud, Coffee, Crown, DollarSign,
  Flame, Frown, Gem, Heart, Meh, Moon, Smile, Star, Sun,
  Tag, ThumbsDown, ThumbsUp, Undo2, Utensils, Wine, XCircle, Zap,
  type LucideIcon,
} from "lucide-react";

const RATING_ICON_MAP: Record<string, ReactNode> = {
  star: <Star size={14} />,
  heart: <Heart size={14} />,
  "dollar-sign": <DollarSign size={14} />,
  "thumbs-up": <ThumbsUp size={14} />,
  "thumbs-down": <ThumbsDown size={14} />,
  "check-circle": <CheckCircle size={14} />,
  "x-circle": <XCircle size={14} />,
  flame: <Flame size={14} />,
  zap: <Zap size={14} />,
  award: <Award size={14} />,
  crown: <Crown size={14} />,
  gem: <Gem size={14} />,
  smile: <Smile size={14} />,
  meh: <Meh size={14} />,
  frown: <Frown size={14} />,
  coffee: <Coffee size={14} />,
  utensils: <Utensils size={14} />,
  wine: <Wine size={14} />,
  beer: <Beer size={14} />,
  moon: <Moon size={14} />,
  sun: <Sun size={14} />,
  cloud: <Cloud size={14} />,
  tag: <Tag size={14} />,
  "undo-2": <Undo2 size={14} />,
};

export { RATING_ICON_MAP };

export { RATING_PRESETS } from "@/lib/ratings";
export type { RatingDefinition, CheckIn } from "@/lib/types";

export function repeatedIcon(Icon: LucideIcon, count: number, size: number, filled = false) {
  return (
    <span className="rating-icon-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span className="rating-icon-stack-item" key={index}>
          <Icon size={size} fill={filled ? "currentColor" : "none"} />
        </span>
      ))}
    </span>
  );
}
