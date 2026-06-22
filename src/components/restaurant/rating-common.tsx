import { type ReactNode } from "react";
import { Tag, type LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

type RatingIconChoice = {
  value: string;
  label: string;
  group: string;
  icon: ReactNode;
};

const RATING_ICON_SPECS = [
  { value: "star", label: "Star", group: "Favorites" },
  { value: "heart", label: "Heart", group: "Favorites" },
  { value: "bookmark", label: "Bookmark", group: "Favorites" },
  { value: "crown", label: "Crown", group: "Favorites" },
  { value: "award", label: "Award", group: "Favorites" },
  { value: "gem", label: "Gem", group: "Favorites" },
  { value: "check-circle", label: "Check circle", group: "Status" },
  { value: "x-circle", label: "X circle", group: "Status" },
  { value: "thumbs-up", label: "Thumbs up", group: "Status" },
  { value: "thumbs-down", label: "Thumbs down", group: "Status" },
  { value: "badge-check", label: "Badge check", group: "Status" },
  { value: "tag", label: "Tag", group: "Status" },
  { value: "flame", label: "Flame", group: "Mood" },
  { value: "zap", label: "Zap", group: "Mood" },
  { value: "sparkles", label: "Sparkles", group: "Mood" },
  { value: "sun", label: "Sun", group: "Mood" },
  { value: "moon", label: "Moon", group: "Mood" },
  { value: "cloud", label: "Cloud", group: "Mood" },
  { value: "smile", label: "Smile", group: "Mood" },
  { value: "smile-plus", label: "Smile plus", group: "Mood" },
  { value: "meh", label: "Meh", group: "Mood" },
  { value: "frown", label: "Frown", group: "Mood" },
  { value: "coffee", label: "Coffee", group: "Drinks" },
  { value: "beer", label: "Beer", group: "Drinks" },
  { value: "beer-off", label: "Beer off", group: "Drinks" },
  { value: "wine", label: "Wine", group: "Drinks" },
  { value: "wine-off", label: "Wine off", group: "Drinks" },
  { value: "bottle-wine", label: "Bottle wine", group: "Drinks" },
  { value: "martini", label: "Martini", group: "Drinks" },
  { value: "glass-water", label: "Glass water", group: "Drinks" },
  { value: "cup-soda", label: "Cup soda", group: "Drinks" },
  { value: "milk", label: "Milk", group: "Drinks" },
  { value: "ice-cream-bowl", label: "Ice cream", group: "Food" },
  { value: "ice-cream", label: "Ice cream", group: "Food" },
  { value: "ice-cream-2", label: "Ice cream 2", group: "Food" },
  { value: "ice-cream-cone", label: "Ice cream cone", group: "Food" },
  { value: "cookie", label: "Cookie", group: "Food" },
  { value: "candy", label: "Candy", group: "Food" },
  { value: "candy-cane", label: "Candy cane", group: "Food" },
  { value: "apple", label: "Apple", group: "Food" },
  { value: "carrot", label: "Carrot", group: "Food" },
  { value: "cherry", label: "Cherry", group: "Food" },
  { value: "croissant", label: "Croissant", group: "Food" },
  { value: "donut", label: "Donut", group: "Food" },
  { value: "drumstick", label: "Drumstick", group: "Food" },
  { value: "egg", label: "Egg", group: "Food" },
  { value: "egg-fried", label: "Egg fried", group: "Food" },
  { value: "grape", label: "Grape", group: "Food" },
  { value: "ham", label: "Ham", group: "Food" },
  { value: "hamburger", label: "Hamburger", group: "Food" },
  { value: "sandwich", label: "Sandwich", group: "Food" },
  { value: "salad", label: "Salad", group: "Food" },
  { value: "shrimp", label: "Shrimp", group: "Food" },
  { value: "utensils", label: "Utensils", group: "Food" },
  { value: "fork-knife", label: "Fork knife", group: "Food" },
  { value: "fork-knife-crossed", label: "Fork knife crossed", group: "Food" },
  { value: "utensils-crossed", label: "Utensils crossed", group: "Food" },
  { value: "soup", label: "Soup", group: "Food" },
  { value: "pizza", label: "Pizza", group: "Food" },
  { value: "fish", label: "Fish", group: "Food" },
  { value: "chef-hat", label: "Chef hat", group: "Food" },
  { value: "wheat", label: "Wheat", group: "Food" },
  { value: "map-pin", label: "Map pin", group: "Places" },
  { value: "compass", label: "Compass", group: "Places" },
  { value: "store", label: "Store", group: "Places" },
  { value: "home", label: "Home", group: "Places" },
  { value: "building-2", label: "Building", group: "Places" },
  { value: "briefcase", label: "Briefcase", group: "Places" },
  { value: "ticket", label: "Ticket", group: "Places" },
  { value: "target", label: "Target", group: "Places" },
  { value: "camera", label: "Camera", group: "Places" },
  { value: "car", label: "Car", group: "Places" },
  { value: "plane", label: "Plane", group: "Places" },
  { value: "train-front", label: "Train", group: "Places" },
  { value: "tree-pine", label: "Tree", group: "Places" },
  { value: "mountain", label: "Mountain", group: "Places" },
  { value: "dumbbell", label: "Dumbbell", group: "Places" },
  { value: "wallet", label: "Wallet", group: "Places" },
  { value: "watch", label: "Watch", group: "Places" },
  { value: "clock-3", label: "Clock", group: "Places" },
  { value: "radio", label: "Radio", group: "Places" },
  { value: "popcorn", label: "Popcorn", group: "Places" },
  { value: "luggage", label: "Luggage", group: "Places" },
  { value: "book-open", label: "Book open", group: "Places" },
  { value: "leaf", label: "Leaf", group: "Places" },
] as const;

function toLucideExportKey(value: string) {
  return value
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join("");
}

function iconFor(value: string): ReactNode {
  const exports = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
  const exportKey = toLucideExportKey(value);
  const Icon = exports[exportKey] ?? exports[`${exportKey}Icon`];
  return Icon ? <Icon size={14} /> : <Tag size={14} />;
}

export const RATING_ICON_CHOICES: RatingIconChoice[] = RATING_ICON_SPECS.map((choice) => ({
  ...choice,
  icon: iconFor(choice.value),
}));

export const RATING_ICON_MAP: Record<string, ReactNode> = Object.fromEntries(
  RATING_ICON_CHOICES.map((choice) => [choice.value, choice.icon]),
);

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
