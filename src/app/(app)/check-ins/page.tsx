import { CheckInsScreen } from "@/components/checkins/check-ins-screen";
import { getCheckInData } from "@/lib/data/check-ins";

export default async function CheckInsPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const data = getCheckInData(Number(list) || null);
  return <CheckInsScreen activeList={data.activeList} checkIns={data.checkIns} />;
}
