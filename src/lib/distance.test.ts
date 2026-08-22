import { describe, expect, it } from "bun:test";
import { distanceMiles, formatDistance } from "./distance";

const NYC = { lat: 40.7128, lon: -74.006 };
const PHILADELPHIA = { lat: 39.9526, lon: -75.1652 };
const LOS_ANGELES = { lat: 34.0522, lon: -118.2437 };

describe("distanceMiles", () => {
  it("measures a known short pair", () => {
    expect(distanceMiles(NYC, PHILADELPHIA)).toBeCloseTo(80.5, 0);
  });

  it("measures a known long pair", () => {
    expect(distanceMiles(NYC, LOS_ANGELES)).toBeCloseTo(2445, -1);
  });

  it("returns zero for the same point", () => {
    expect(distanceMiles(NYC, NYC)).toBe(0);
  });

  it("is symmetric", () => {
    expect(distanceMiles(NYC, PHILADELPHIA)).toBeCloseTo(distanceMiles(PHILADELPHIA, NYC), 10);
  });
});

describe("formatDistance", () => {
  it("collapses very short distances", () => {
    expect(formatDistance(0)).toBe("< 0.1 mi");
    expect(formatDistance(0.09)).toBe("< 0.1 mi");
  });

  it("uses one decimal below ten miles", () => {
    expect(formatDistance(0.1)).toBe("0.1 mi");
    expect(formatDistance(2.34)).toBe("2.3 mi");
    expect(formatDistance(9.94)).toBe("9.9 mi");
  });

  it("drops decimals at ten miles and above", () => {
    expect(formatDistance(10)).toBe("10 mi");
    expect(formatDistance(42.6)).toBe("43 mi");
  });
});
