import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, MapPinCheck, Pencil, Trash2, UserRound } from "lucide-react";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { useToast } from "@/hooks/use-toast";
import { formatCheckInTime } from "@/lib/check-ins";
import { formatCheckInDate, localDateTimeInputValue } from "@/lib/datetime";
import type { CheckIn } from "@/lib/types";
import type { Restaurant } from "@/lib/types";

export function CheckInCard({
  canWrite,
  checkIn,
  restaurantId,
}: {
  canWrite: boolean;
  checkIn: CheckIn;
  restaurantId: number;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [visitedAt, setVisitedAt] = useState(checkIn.visitedAt);

  if (mode === "edit") {
    return (
      <form action="/mutate" method="post" className="checkin-card checkin-card-editing" onSubmit={() => setMode("preview")}>
        <input type="hidden" name="__action" value="updateCheckIn" />
        <input type="hidden" name="restaurantId" value={restaurantId} />
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
      <time className="checkin-time" dateTime={checkIn.visitedAt}>{formatCheckInTime(checkIn.visitedAt)}</time>
      <div className="checkin-card-content">
        <span className="checkin-date">{formatCheckInDate(checkIn.visitedAt)}</span>
        <span className="checkin-author"><UserRound size={13} /> {checkIn.authorName}</span>
      </div>
        {canWrite ? (
          <div className="checkin-actions">
            <button type="button" className="ghost-button icon-button" onClick={() => setMode("edit")} aria-label="Edit check-in"><Pencil size={16} /></button>
            <form action="/mutate" method="post" className="inline-form">
              <input type="hidden" name="__action" value="deleteCheckIn" />
              <input type="hidden" name="restaurantId" value={restaurantId} />
              <input type="hidden" name="checkInId" value={checkIn.id} />
              <button className="ghost-button icon-only" aria-label="Delete check-in" onClick={() => navigator.vibrate?.([10, 50, 10])}><Trash2 size={16} /></button>
            </form>
          </div>
        ) : null}
    </article>
  );
}

/**
 * One-tap "I'm here now" Check-in for the Restaurant header. The visit time is
 * stamped when the button is pressed, so a screen left open still logs the moment
 * it was tapped. A toast confirms it and offers Undo, since this is easy to tap by accident.
 */
export function QuickCheckIn({ entry }: { entry: Restaurant }) {
  const router = useRouter();
  const { submit } = useAppMutation();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);

  async function undo(checkInId: number) {
    const formData = new FormData();
    formData.set("__action", "deleteCheckIn");
    formData.set("restaurantId", String(entry.id));
    formData.set("checkInId", String(checkInId));
    const result = await submit(formData);
    if (result.ok) router.refresh();
    else if (result.code !== "offline") show({ message: result.message, tone: "error" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Handled here rather than by the shared form handler so the result can drive the toast.
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    formData.set("visitedAt", localDateTimeInputValue());
    const visits = entry.checkInCount + 1;
    const result = await submit(formData);
    setSaving(false);
    if (!result.ok) {
      // "offline" failures are already reported by the app; anything else is shown here.
      if (result.code !== "offline") show({ message: result.message, tone: "error" });
      return;
    }
    if (result.queued) {
      show({ message: "Saved on this device. It will sync when you're back online." });
      return;
    }
    router.refresh();
    const checkInId = result.checkInId;
    show({
      message: `Checked in · ${visits} ${visits === 1 ? "visit" : "visits"}`,
      ...(checkInId ? { actionLabel: "Undo", onAction: () => void undo(checkInId) } : {}),
    });
  }

  return (
    <form action="/mutate" method="post" className="quick-checkin" onSubmit={(event) => void handleSubmit(event)}>
      <input type="hidden" name="__action" value="createCheckIn" />
      <input type="hidden" name="restaurantId" value={entry.id} />
      <button className="detail-action primary" disabled={saving} aria-label={`Check in at ${entry.name} now`}>
        <MapPinCheck size={18} aria-hidden="true" />
        <span>Check in</span>
      </button>
    </form>
  );
}

/** Secondary entry point for back-dating: a button that opens the time picker panel. */
export function PastVisitForm({ entry }: { entry: Restaurant }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="ghost-button past-visit-toggle" onClick={() => setOpen(true)}>
        <CalendarPlus size={16} aria-hidden="true" />
        Log a past visit
      </button>
    );
  }
  return (
    <div className="past-visit-panel">
      <div className="past-visit-head">
        <strong>Log a past visit</strong>
        <button type="button" className="ghost-button compact-button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <CheckInForm entry={entry} />
    </div>
  );
}

/** Logs a visit at a chosen time, for back-dating a Check-in. */
export function CheckInForm({ entry }: { entry: Restaurant }) {
  return (
    <form action="/mutate" method="post" className="checkin-new">
      <input type="hidden" name="__action" value="createCheckIn" />
      <input type="hidden" name="restaurantId" value={entry.id} />
      <div className="checkin-new-row">
        <label className="datetime-field checkin-datetime">
          <span className="checkin-new-icon" aria-hidden="true"><CalendarPlus size={17} /></span>
          <span className="sr-only">Visit time</span>
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
