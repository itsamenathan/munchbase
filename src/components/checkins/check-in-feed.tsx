import Link from "next/link";
import { CalendarClock, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCityState } from "@/lib/address";
import { buildCheckInFeed, formatCheckInTime, groupCheckInFeed } from "@/lib/check-ins";
import { checkInRestaurantHref, tabHref } from "@/lib/routes";
import type { Restaurant } from "@/lib/types";

export function CheckInFeed({
  restaurants,
  activeListId,
  activeListName,
}: {
  restaurants: Restaurant[];
  activeListId: number | null;
  activeListName: string;
}) {
  const checkIns = buildCheckInFeed(restaurants);
  const groups = groupCheckInFeed(checkIns);

  return (
    <section className="checkin-feed" aria-labelledby="checkin-feed-title">
      <header className="checkin-feed-header">
        <h3 id="checkin-feed-title">Check-ins</h3>
        <p>{activeListName}</p>
      </header>
      {groups.length === 0 ? (
        <div className="checkin-feed-empty">
          <EmptyState
            icon={<CalendarClock size={32} />}
            title="No check-ins yet."
            description="Log a visit from a Restaurant to see it here."
            action={(
              <Link className="ghost-button" href={tabHref("list", activeListId)}>
                Explore Restaurants
              </Link>
            )}
          />
        </div>
      ) : groups.map((group) => (
        <section className="checkin-day-group" aria-labelledby={`checkin-day-${group.dateKey}`} key={group.dateKey}>
          <h4 className="checkin-day-heading" id={`checkin-day-${group.dateKey}`}>{group.label}</h4>
          {group.checkIns.map((checkIn) => (
            <Link
              className="checkin-feed-row"
              href={checkInRestaurantHref(checkIn.restaurantId, activeListId)}
              key={checkIn.id}
            >
              <span className="checkin-feed-main">
                <strong>{checkIn.restaurantName}</strong>
                {checkIn.restaurantAddress ? <small>{formatCityState(checkIn.restaurantAddress) || checkIn.restaurantAddress}</small> : null}
                {checkIn.notes ? <span className="checkin-feed-note">{checkIn.notes}</span> : null}
              </span>
              <span className="checkin-feed-meta">
                <time dateTime={checkIn.visitedAt}>{formatCheckInTime(checkIn.visitedAt)}</time>
                <span className="checkin-feed-author"><UserRound size={12} /> by {checkIn.authorName}</span>
              </span>
            </Link>
          ))}
        </section>
      ))}
    </section>
  );
}
