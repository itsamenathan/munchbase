import {
  addListStep,
  restaurantOrigin,
  type AddListStep,
  type BottomTab,
  type RestaurantOrigin,
} from "@/lib/routes";

/** The subset of URLSearchParams this module needs, so callers can pass Next's
 *  ReadonlyURLSearchParams or a plain URLSearchParams interchangeably. */
type ReadableParams = { get(key: string): string | null };

export type AppRouteState = {
  activeListId: number | null;
  selectedRestaurantId: number | null;
  restaurantOrigin: RestaurantOrigin;
  restaurantEditing: boolean;
  activeTab: BottomTab;
  settingsOpen: boolean;
  addOpen: boolean;
  addListOpen: boolean;
  addListStep: AddListStep;
  adminOpen: boolean;
  activePhotoId: number | null;
};

function positiveInt(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Derives every piece of UI state that lives in the URL. Restaurant detail and
 * list settings are real routes, but AppShell renders their content inline, so
 * the pathname is the single source of truth for which panel is open.
 */
export function deriveAppRouteState(
  pathname: string,
  params: ReadableParams,
  userRole: string,
): AppRouteState {
  // List settings carries its id in the path; every other route uses ?list=.
  const settingsListId = positiveInt(pathname.match(/^\/lists\/(\d+)\/settings$/)?.[1] ?? null);
  const activeListId = settingsListId ?? positiveInt(params.get("list"));

  const selectedRestaurantId = positiveInt(pathname.match(/^\/restaurants\/(\d+)$/)?.[1] ?? null);
  const origin = restaurantOrigin(params.get("from"));

  const activeTab: BottomTab = selectedRestaurantId
    ? origin
    : pathname.startsWith("/check-ins")
      ? "checkins"
      : pathname.startsWith("/map")
        ? "map"
        : pathname.startsWith("/lists")
          ? "lists"
          : "explore";

  return {
    activeListId,
    selectedRestaurantId,
    restaurantOrigin: origin,
    restaurantEditing: params.get("edit") === "1",
    activeTab,
    settingsOpen: pathname === "/lists/settings" || /^\/lists\/\d+\/settings$/.test(pathname),
    addOpen: pathname.startsWith("/add"),
    addListOpen: pathname === "/lists" && params.get("overlay") === "add-list",
    addListStep: addListStep(params.get("step")),
    adminOpen: userRole === "admin" && params.get("overlay") === "admin",
    activePhotoId: positiveInt(params.get("photo")),
  };
}
