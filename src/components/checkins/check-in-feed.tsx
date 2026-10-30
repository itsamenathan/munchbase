import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCityState } from "@/lib/address";
import { buildCheckInFeed, formatCheckInTime, groupCheckInFeed } from "@/lib/check-ins";
import { checkInRestaurantHref, tabHref } from "@/lib/routes";
import type { Restaurant } from "@/lib/types";

export function CheckInFeed({
  restaurants,
  activeListId,
  onOpenRestaurant,
}: {
  restaurants: Restaurant[];
  activeListId: number | null;
  onOpenRestaurant?: () => void;
}) {
  const checkIns = buildCheckInFeed(restaurants);
  const groups = groupCheckInFeed(checkIns);
  const photoByRestaurant = new Map(restaurants.map((r) => [r.id, r.photos[0]?.thumbnailUrl ?? null]));
  const visitLabel = `${checkIns.length} ${checkIns.length === 1 ? "visit" : "visits"}`;

  return (
    <section className="checkin-feed" aria-labelledby="checkin-feed-title">
      <header className="checkin-feed-header">
        <div>
          <h3 id="checkin-feed-title">Check-in history</h3>
          {checkIns.length > 0 ? <p>{visitLabel}</p> : null}
        </div>
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
      ) : groups.map((group) => {
        const visits = group.checkIns.length;
        return (
          <section className="checkin-day" aria-labelledby={`checkin-day-${group.dateKey}`} key={group.dateKey}>
            <header className="checkin-day-head">
              <h4 id={`checkin-day-${group.dateKey}`}>{group.label}</h4>
              <span>{visits} {visits === 1 ? "visit" : "visits"}</span>
            </header>
            <ol className="checkin-day-visits">
              {group.checkIns.map((checkIn) => {
                const address = checkIn.restaurantAddress ? formatCityState(checkIn.restaurantAddress) || checkIn.restaurantAddress : null;
                return (
                  <li key={checkIn.id}>
                    <Link
                      className="checkin-visit"
                      href={checkInRestaurantHref(checkIn.restaurantId, activeListId)}
                      onClick={onOpenRestaurant}
                    >
                      <time className="checkin-visit-time" dateTime={checkIn.visitedAt}>{formatCheckInTime(checkIn.visitedAt)}</time>
                      <span className="checkin-visit-body">
                        <strong>{checkIn.restaurantName}</strong>
                        <small>{[address, checkIn.authorName].filter(Boolean).join(" · ")}</small>
                        {checkIn.notes ? <span className="checkin-visit-note">{checkIn.notes}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </section>
  );
}
