import type { Restaurant } from "@/lib/types";

export type CheckInFeedItem = Restaurant["checkIns"][number] & {
  restaurantId: number;
  restaurantName: string;
  restaurantAddress: string | null;
};

export type CheckInDayGroup = {
  dateKey: string;
  label: string;
  checkIns: CheckInFeedItem[];
};

function localDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateLabel(dateKey: string, now: Date) {
  if (dateKey === localDateKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return "Yesterday";

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if ([year, month, day].some((part) => !Number.isFinite(part)) || Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function buildCheckInFeed(restaurants: Restaurant[]): CheckInFeedItem[] {
  return restaurants
    .flatMap((restaurant) => restaurant.checkIns.map((checkIn) => ({
      ...checkIn,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
    })))
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt) || b.id - a.id);
}

export function groupCheckInFeed(checkIns: CheckInFeedItem[], now = new Date()): CheckInDayGroup[] {
  const groups = new globalThis.Map<string, CheckInFeedItem[]>();
  checkIns.forEach((checkIn) => {
    const dateKey = checkIn.visitedAt.split("T")[0] || checkIn.visitedAt;
    const group = groups.get(dateKey) ?? [];
    group.push(checkIn);
    groups.set(dateKey, group);
  });
  return [...groups].map(([dateKey, groupedCheckIns]) => ({
    dateKey,
    label: dateLabel(dateKey, now),
    checkIns: groupedCheckIns,
  }));
}

export function formatCheckInTime(value: string) {
  const [, time = ""] = value.split("T");
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
