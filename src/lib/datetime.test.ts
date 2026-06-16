import { describe, expect, it } from "vitest";
import { formatShortDateTime, formatWallDateTime, localDateTimeInputValue } from "./datetime";

describe("wall time datetime helpers", () => {
  it("formats datetime-local values without timezone conversion", () => {
    expect(formatWallDateTime("2026-06-15T18:30")).toBe("06/15/2026 18:30");
  });

  it("creates datetime-local values from local date components", () => {
    expect(localDateTimeInputValue(new Date(2026, 5, 15, 18, 30))).toBe("2026-06-15T18:30");
  });

  it("formats short readable datetime", () => {
    const formatted = formatShortDateTime("2026-06-15T18:30");
    expect(formatted).toContain("Jun");
    expect(formatted).toContain("15");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("6:30");
    expect(formatted).toMatch(/PM|18:30/);
  });
});
