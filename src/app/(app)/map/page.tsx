import { ExploreScreen } from "@/components/explore/explore-screen";
import { getMapData } from "@/lib/data/map";

export default async function MapPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const data = getMapData(Number(list) || null);
  return <ExploreScreen mode="map" activeList={data.activeList} restaurants={data.restaurants} globalRatingDefinitions={data.globalRatingDefinitions} listRatingDefinitions={data.listRatingDefinitions} />;
}
