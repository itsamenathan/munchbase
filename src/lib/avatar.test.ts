import { describe, expect, it } from "vitest";
import { avatarHue, monogram } from "./avatar";

describe("avatarHue", () => {
  it("is stable for the same name regardless of case and padding", () => {
    expect(avatarHue("Harbor & Pine")).toBe(avatarHue("  harbor & pine "));
  });

  it("stays within the hue circle", () => {
    for (const name of ["", "A", "Paper Crane Noodles", "Bäco Mercat", "🍜 Ramen"]) {
      const hue = avatarHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe("monogram", () => {
  it("uses the first letter or digit", () => {
    expect(monogram("harbor & pine")).toBe("H");
    expect(monogram("& Olive")).toBe("O");
    expect(monogram("7th Street Deli")).toBe("7");
    expect(monogram("Österia")).toBe("Ö");
  });

  it("falls back when the name has no letters", () => {
    expect(monogram("&&")).toBe("?");
  });
});
