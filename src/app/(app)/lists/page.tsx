import { notFound } from "next/navigation";
import { ListsScreen } from "@/components/lists/lists-screen";
import { currentUser } from "@/lib/auth";
import { getListsData } from "@/lib/data/lists";

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ overlay?: string }> }) {
  const [user, query] = await Promise.all([currentUser(), searchParams]);
  if (!user) notFound();
  const data = getListsData(query.overlay === "add-list");
  return <ListsScreen user={user} lists={data.lists} totalRestaurantCount={data.totalRestaurantCount} restaurants={data.restaurants} />;
}
