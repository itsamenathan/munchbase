import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, Pencil, Trash2, UserRound } from "lucide-react";
import { formatShortDateTime, localDateTimeInputValue } from "@/lib/datetime";
import type { CheckIn } from "@/lib/types";
import type { Restaurant } from "@/lib/types";
import { submitMutation } from "@/lib/mutation-client";

export function CheckInCard({ canWrite, checkIn }: { canWrite: boolean; checkIn: CheckIn }) {
  const router = useRouter();
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [visitedAt, setVisitedAt] = useState(checkIn.visitedAt);

  if (mode === "edit") {
    return (
      <form action="/mutate" method="post" className="checkin-card checkin-card-editing" onSubmit={async (event) => {
        event.preventDefault();
        const result = await submitMutation(event.currentTarget);
        if (result.ok) {
          setMode("preview");
          router.refresh();
        } else {
          router.replace(result.redirectTo, { scroll: false });
        }
      }}>
        <input type="hidden" name="__action" value="updateCheckIn" />
        <input type="hidden" name="checkInId" value={checkIn.id} />
        <div className="checkin-edit-head">
          <span className="checkin-avatar" aria-hidden="true"><UserRound size={15} /></span>
          <strong>{checkIn.authorName}</strong>
        </div>
        <div className="checkin-edit-fields">
          <DateTimeField value={visitedAt} onChange={setVisitedAt} />
          <div className="checkin-actions">
            <button>Save</button>
            <button type="button" className="ghost-button" onClick={() => { setVisitedAt(checkIn.visitedAt); setMode("preview"); }}>Cancel</button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <article className="checkin-card">
      <span className="checkin-timeline-dot" aria-hidden="true"><CalendarClock size={14} /></span>
      <div className="checkin-card-content">
        <time className="checkin-date" dateTime={checkIn.visitedAt}>{formatShortDateTime(checkIn.visitedAt)}</time>
        <span className="checkin-author"><UserRound size={13} /> {checkIn.authorName}</span>
      </div>
        {canWrite ? (
          <div className="checkin-actions">
            <button type="button" className="ghost-button icon-button" onClick={() => setMode("edit")} aria-label="Edit check-in"><Pencil size={16} /></button>
            <form action="/mutate" method="post" className="inline-form">
              <input type="hidden" name="__action" value="deleteCheckIn" />
              <input type="hidden" name="checkInId" value={checkIn.id} />
              <button className="ghost-button icon-only" aria-label="Delete check-in" onClick={() => navigator.vibrate?.([10, 50, 10])}><Trash2 size={16} /></button>
            </form>
          </div>
        ) : null}
    </article>
  );
}

export function CheckInForm({ entry }: { entry: Restaurant }) {
  return (
    <form action="/mutate" method="post" className="checkin-new">
      <input type="hidden" name="__action" value="createCheckIn" />
      <input type="hidden" name="restaurantId" value={entry.id} />
      <div className="checkin-new-row">
        <span className="checkin-new-icon" aria-hidden="true"><CalendarPlus size={17} /></span>
        <label className="datetime-field checkin-datetime">
          <span className="sr-only">Visit time</span>
          <input name="visitedAt" type="datetime-local" defaultValue={localDateTimeInputValue()} />
        </label>
        <button className="checkin-log-btn">Check in</button>
      </div>
    </form>
  );
}

function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="datetime-field compact">
      <span><CalendarClock size={14} />Visit time</span>
      <input name="visitedAt" type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
