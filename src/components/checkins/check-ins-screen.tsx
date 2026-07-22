import { CalendarClock } from "lucide-react";
import { CheckInFeed } from "./check-in-feed";
import { EmptyState } from "@/components/shared/empty-state";
import type { CheckInFeedItem } from "@/lib/check-ins";
import type { List } from "@/lib/types";

export function CheckInsScreen({ activeList, checkIns }: { activeList: List | null; checkIns: CheckInFeedItem[] }) {
  return (
    <div className="content-grid checkin-content-grid">
      <CheckInFeed checkIns={checkIns} activeListId={activeList?.id ?? null} activeListName={activeList?.name ?? "All restaurants"} />
      <section className="detail"><EmptyState icon={<CalendarClock size={28} />} title="Select a check-in" description="Pick a visit to see its Restaurant details." /></section>
    </div>
  );
}
