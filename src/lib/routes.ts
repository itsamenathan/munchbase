export type BottomTab = "explore" | "map" | "checkins" | "lists";
export type RestaurantOrigin = "explore" | "map" | "checkins";
export type AddListStep = "details" | "fields" | "restaurants";

export function listQuery(listId: number | null) {
  return listId ? `?list=${listId}` : "";
}

export function tabHref(tab: BottomTab, listId: number | null) {
  const path = tab === "explore" ? "/explore" : tab === "checkins" ? "/check-ins" : `/${tab}`;
  return `${path}${listQuery(listId)}`;
}

export function addHref(listId: number | null) {
  return `/add${listQuery(listId)}`;
}

export function checkInRestaurantHref(id: number, listId: number | null) {
  return restaurantHref(id, listId, { origin: "checkins" });
}

export function restaurantHref(
  id: number,
  listId: number | null,
  options: { origin?: RestaurantOrigin; edit?: boolean; photoId?: number | null } = {},
) {
  const params = new URLSearchParams();
  params.set("from", options.origin ?? "explore");
  if (listId) params.set("list", String(listId));
  if (options.edit) params.set("edit", "1");
  if (options.photoId) params.set("photo", String(options.photoId));
  const query = params.toString();
  return `/restaurants/${id}${query ? `?${query}` : ""}`;
}

export function restaurantOrigin(value: string | null): RestaurantOrigin {
  return value === "map" || value === "checkins" ? value : "explore";
}

export function restaurantOriginHref(origin: RestaurantOrigin, listId: number | null) {
  return tabHref(origin, listId);
}

export function addListHref(listId: number | null, step: AddListStep = "details") {
  const params = new URLSearchParams();
  if (listId) params.set("list", String(listId));
  params.set("overlay", "add-list");
  params.set("step", step);
  return `/lists?${params.toString()}`;
}

export function addListStep(value: string | null): AddListStep {
  return value === "fields" || value === "restaurants" ? value : "details";
}

export function listSettingsHref(listId: number | null) {
  return listId ? `/lists/${listId}/settings` : "/lists/settings";
}
