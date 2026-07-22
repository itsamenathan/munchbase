import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getAddData } from "@/lib/data/add";
import { getAdminData } from "@/lib/data/admin";
import { getRestaurantDetailData } from "@/lib/data/restaurants";
import { getListSettingsData } from "@/lib/data/settings";
import { AddScreen } from "@/components/search/add-screen";
import { AdminRoutePanel } from "@/components/admin/admin-route-panel";
import { RestaurantPanel } from "@/components/restaurant/restaurant-panel";
import { ListSettingsRoutePanel } from "@/components/lists/list-settings-panel-route";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function numberValue(params: Record<string, string | string[] | undefined>, key: string) {
  const parsed = Number(value(params, key));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function AddRoute({ searchParams, intercepted = false }: { searchParams: SearchParams; intercepted?: boolean }) {
  const params = await searchParams;
  const data = getAddData(numberValue(params, "list"));
  return <AddScreen activeList={data.activeList} restaurants={data.restaurants} sheet={intercepted} />;
}

export async function RestaurantRoute({ params, searchParams, intercepted = false }: { params: Promise<{ id: string }>; searchParams: SearchParams; intercepted?: boolean }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId) || restaurantId < 1) notFound();
  const listId = numberValue(query, "list");
  const data = getRestaurantDetailData(restaurantId, listId);
  if (!data) notFound();
  return <RestaurantPanel data={data} listId={listId} from={value(query, "from") ?? null} initialEdit={value(query, "edit") === "1"} activePhotoId={numberValue(query, "photo")} intercepted={intercepted} />;
}

export async function SettingsRoute({ listId, intercepted = false }: { listId: number | null; intercepted?: boolean }) {
  const data = getListSettingsData(listId);
  if (!data) notFound();
  return <ListSettingsRoutePanel data={data} intercepted={intercepted} />;
}

export async function AdminRoute({ searchParams }: { searchParams: SearchParams }) {
  const [user, query] = await Promise.all([currentUser(), searchParams]);
  if (!user) notFound();
  const data = getAdminData(user);
  if (!data) notFound();
  return <AdminRoutePanel data={data} returnTo={value(query, "returnTo") ?? "/explore"} />;
}
