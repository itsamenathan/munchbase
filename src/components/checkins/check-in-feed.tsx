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
  onOpenRestaurant,
}: {
  restaurants: Restaurant[];
  activeListId: number | null;
  activeListName: string;
  onOpenRestaurant?: () => void;
}) {
  const checkIns = buildCheckInFeed(restaurants);
  const groups = groupCheckInFeed(checkIns);
  const visitLabel = `${checkIns.length} ${checkIns.length === 1 ? "visit" : "visits"}`;

  return (
    <section className="checkin-feed" aria-labelledby="checkin-feed-title">
      <header className="checkin-feed-header">
        <div>
          <h3 id="checkin-feed-title">Check-in history</h3>
          <p>{activeListName}</p>
        </div>
        {checkIns.length > 0 ? <span className="checkin-feed-count">{visitLabel}</span> : null}
      </header>
      {groups.length === 0 ? (
        <div className="checkin-feed-empty">
          <EmptyState
            icon={<CalendarClock size={32} />}
            title="No check-ins yet."
            description="Log a visit from a Restaurant to see it here."
            action={(
              <Link className="ghost-button" replace href={tabHref("explore", activeListId)}>
                Explore Restaurants
              </Link>
            )}
          />
        </div>
      ) : groups.map((group) => (
        <section className="checkin-day-group" aria-labelledby={`checkin-day-${group.dateKey}`} key={group.dateKey}>
          <h4 className="checkin-day-heading" id={`checkin-day-${group.dateKey}`}>{group.label}</h4>
          <div className="checkin-history-list">
            {group.checkIns.map((checkIn) => (
              <Link
                className="checkin-history-item"
                href={checkInRestaurantHref(checkIn.restaurantId, activeListId)}
                onClick={onOpenRestaurant}
                key={checkIn.id}
              >
                <span className="checkin-history-marker" aria-hidden="true"><CalendarClock size={14} /></span>
                <span className="checkin-history-content">
                  <span className="checkin-history-heading">
                    <strong>{checkIn.restaurantName}</strong>
                    <time dateTime={checkIn.visitedAt}>{formatCheckInTime(checkIn.visitedAt)}</time>
                  </span>
                  {checkIn.restaurantAddress ? <small>{formatCityState(checkIn.restaurantAddress) || checkIn.restaurantAddress}</small> : null}
                  {checkIn.notes ? <span className="checkin-feed-note">{checkIn.notes}</span> : null}
                  <span className="checkin-feed-author"><UserRound size={12} /> {checkIn.authorName}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
