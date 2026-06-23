import { useState } from "react";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { formatShortDateTime, localDateTimeInputValue } from "@/lib/datetime";
import type { CheckIn } from "@/lib/types";
import type { Restaurant } from "@/lib/types";

export function CheckInCard({ canWrite, checkIn }: { canWrite: boolean; checkIn: CheckIn }) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [visitedAt, setVisitedAt] = useState(checkIn.visitedAt);

  if (mode === "edit") {
    return (
      <form action="/mutate" method="post" className="checkin-card checkin-card-editing">
        <input type="hidden" name="__action" value="updateCheckIn" />
        <input type="hidden" name="checkInId" value={checkIn.id} />
        <div className="checkin-meta">
          <strong>{checkIn.authorName}</strong>
          <DateTimeField value={visitedAt} onChange={setVisitedAt} />
        </div>
        <div className="checkin-actions">
          <button>Save</button>
          <button type="button" className="ghost-button" onClick={() => { setVisitedAt(checkIn.visitedAt); setMode("preview"); }}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <article className="checkin-card">
      <div className="checkin-meta">
        <strong>{checkIn.authorName}</strong>
        <span className="checkin-date"><CalendarClock size={14} />{formatShortDateTime(checkIn.visitedAt)}</span>
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
      </div>
    </article>
  );
}

export function CheckInForm({ entry }: { entry: Restaurant }) {
  return (
    <form action="/mutate" method="post" className="checkin-new">
      <input type="hidden" name="__action" value="createCheckIn" />
      <input type="hidden" name="restaurantId" value={entry.id} />
      <div className="checkin-new-row">
        <label className="datetime-field checkin-datetime">
          <span><CalendarClock size={14} />When</span>
          <input name="visitedAt" type="datetime-local" defaultValue={localDateTimeInputValue()} />
        </label>
        <button className="checkin-log-btn">Log visit</button>
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
