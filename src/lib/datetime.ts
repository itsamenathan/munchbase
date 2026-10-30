export function localDateTimeInputValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function formatWallDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  const [year, month, day] = date.split("-");
  const [hour = "", minute = ""] = time.split(":");
  if (!year || !month || !day || !hour || !minute) return value;
  return `${month}/${day}/${year} ${hour}:${minute}`;
}

/** Date only, for rows that show the time separately: "Wed, Oct 28, 2026". */
export function formatCheckInDate(value: string) {
  const [date = ""] = value.split("T");
  const parsed = new Date(`${date}T00:00`);
  if (!date || isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  if (!date) return value;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
