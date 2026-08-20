import { describe, expect, it } from "vitest";
import { buildVersionInfo } from "./version";

describe("buildVersionInfo", () => {
  it("builds a label and commit link from git metadata", () => {
    const info = buildVersionInfo("2026-03-01", "05017a9c4f1e2b3d4a5b6c7d8e9f0a1b2c3d4e5f");
    expect(info).toEqual({
      label: "v2026-03-01",
      shortCommit: "05017a9",
      commitUrl: "https://github.com/itsamenathan/munchbase/commit/05017a9c4f1e2b3d4a5b6c7d8e9f0a1b2c3d4e5f",
    });
  });

  it("accepts an already-abbreviated commit and normalizes case", () => {
    const info = buildVersionInfo("2026-03-01", "05017A9");
    expect(info?.shortCommit).toBe("05017a9");
    expect(info?.commitUrl).toBe("https://github.com/itsamenathan/munchbase/commit/05017a9");
  });

  it("ignores dates that are not YYYY-MM-DD", () => {
    expect(buildVersionInfo("Sun Mar 1 2026", "05017a9")?.label).toBeNull();
  });

  it("drops the link when the commit is missing or malformed", () => {
    expect(buildVersionInfo("2026-03-01", "")).toEqual({
      label: "v2026-03-01",
      shortCommit: null,
      commitUrl: null,
    });
    expect(buildVersionInfo("2026-03-01", "not-a-sha")?.commitUrl).toBeNull();
  });

  it("returns null when nothing was stamped", () => {
    expect(buildVersionInfo()).toBeNull();
    expect(buildVersionInfo("", "")).toBeNull();
  });
});
