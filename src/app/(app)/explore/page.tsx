import { ExploreScreen } from "@/components/explore/explore-screen";
import { getExploreData } from "@/lib/data/explore";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const data = getExploreData(Number(list) || null);
  return <ExploreScreen mode="explore" activeList={data.activeList} restaurants={data.restaurants} globalRatingDefinitions={data.globalRatingDefinitions} listRatingDefinitions={data.listRatingDefinitions} />;
}
