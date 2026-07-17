export type BottomTab = "list" | "map" | "checkins" | "lists" | "add";

export function listQuery(listId: number | null) {
  return listId ? `?list=${listId}` : "";
}

export function tabHref(tab: BottomTab, listId: number | null) {
  const path = tab === "list" ? "/explore" : tab === "checkins" ? "/check-ins" : `/${tab}`;
  return `${path}${listQuery(listId)}`;
}

export function checkInRestaurantHref(id: number, listId: number | null) {
  const params = new URLSearchParams({ from: "checkins" });
  if (listId) params.set("list", String(listId));
  return `/restaurants/${id}?${params.toString()}`;
}

export function restaurantHref(id: number, listId: number | null, edit = false) {
  const params = new URLSearchParams();
  if (listId) params.set("list", String(listId));
  if (edit) params.set("edit", "1");
  const query = params.toString();
  return `/restaurants/${id}${query ? `?${query}` : ""}`;
}

export function listSettingsHref(listId: number | null) {
  return listId ? `/lists/${listId}/settings` : "/lists/settings";
}
