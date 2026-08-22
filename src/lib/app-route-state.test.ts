import { describe, expect, it } from "bun:test";
import { deriveAppRouteState } from "./app-route-state";

function derive(url: string, userRole = "user") {
  const [pathname, search = ""] = url.split("?");
  return deriveAppRouteState(pathname, new URLSearchParams(search), userRole);
}

describe("Active tab", () => {
  it("defaults to Explore", () => {
    expect(derive("/explore").activeTab).toBe("explore");
    expect(derive("/").activeTab).toBe("explore");
  });

  it("resolves each root route", () => {
    expect(derive("/map").activeTab).toBe("map");
    expect(derive("/check-ins").activeTab).toBe("checkins");
    expect(derive("/lists").activeTab).toBe("lists");
  });

  it("follows the Restaurant origin so the tab survives detail navigation", () => {
    expect(derive("/restaurants/12?from=map").activeTab).toBe("map");
    expect(derive("/restaurants/12?from=checkins").activeTab).toBe("checkins");
    expect(derive("/restaurants/12").activeTab).toBe("explore");
  });
});

describe("Active list", () => {
  it("reads ?list=", () => {
    expect(derive("/explore?list=3").activeListId).toBe(3);
    expect(derive("/explore").activeListId).toBeNull();
  });

  it("prefers the List settings path id over ?list=", () => {
    expect(derive("/lists/3/settings?list=9").activeListId).toBe(3);
  });

  it("ignores non-positive and malformed ids", () => {
    expect(derive("/explore?list=abc").activeListId).toBeNull();
    expect(derive("/explore?list=0").activeListId).toBeNull();
    expect(derive("/explore?list=-2").activeListId).toBeNull();
    expect(derive("/explore?list=1.5").activeListId).toBeNull();
  });
});

describe("Selected restaurant", () => {
  it("reads the id from the path", () => {
    expect(derive("/restaurants/12").selectedRestaurantId).toBe(12);
    expect(derive("/explore").selectedRestaurantId).toBeNull();
  });

  it("does not match nested Restaurant routes", () => {
    expect(derive("/restaurants/12/photos").selectedRestaurantId).toBeNull();
  });

  it("tracks the edit flag", () => {
    expect(derive("/restaurants/12?edit=1").restaurantEditing).toBe(true);
    expect(derive("/restaurants/12").restaurantEditing).toBe(false);
    expect(derive("/restaurants/12?edit=0").restaurantEditing).toBe(false);
  });

  it("falls back to Explore for an unknown origin", () => {
    expect(derive("/restaurants/12?from=bogus").restaurantOrigin).toBe("explore");
  });
});

describe("List settings", () => {
  it("opens for both the global and per-list routes", () => {
    expect(derive("/lists/settings").settingsOpen).toBe(true);
    expect(derive("/lists/3/settings").settingsOpen).toBe(true);
    expect(derive("/lists").settingsOpen).toBe(false);
  });
});

describe("Add flow", () => {
  it("opens on the /add route", () => {
    expect(derive("/add").addOpen).toBe(true);
    expect(derive("/add?list=3").addOpen).toBe(true);
    expect(derive("/explore").addOpen).toBe(false);
  });
});

describe("Add list overlay", () => {
  it("requires both the /lists route and the overlay param", () => {
    expect(derive("/lists?overlay=add-list").addListOpen).toBe(true);
    expect(derive("/explore?overlay=add-list").addListOpen).toBe(false);
    expect(derive("/lists").addListOpen).toBe(false);
  });

  it("resolves each wizard step, defaulting to details", () => {
    expect(derive("/lists?overlay=add-list&step=details").addListStep).toBe("details");
    expect(derive("/lists?overlay=add-list&step=fields").addListStep).toBe("fields");
    expect(derive("/lists?overlay=add-list&step=restaurants").addListStep).toBe("restaurants");
    expect(derive("/lists?overlay=add-list&step=bogus").addListStep).toBe("details");
    expect(derive("/lists?overlay=add-list").addListStep).toBe("details");
  });
});

describe("Admin overlay", () => {
  it("opens only for an admin", () => {
    expect(derive("/explore?overlay=admin", "admin").adminOpen).toBe(true);
    expect(derive("/explore?overlay=admin", "user").adminOpen).toBe(false);
  });

  it("stays closed without the overlay param", () => {
    expect(derive("/explore", "admin").adminOpen).toBe(false);
  });
});

describe("Photo viewer", () => {
  it("reads ?photo=", () => {
    expect(derive("/restaurants/12?photo=4").activePhotoId).toBe(4);
    expect(derive("/restaurants/12").activePhotoId).toBeNull();
  });

  it("ignores malformed ids", () => {
    expect(derive("/restaurants/12?photo=xyz").activePhotoId).toBeNull();
    expect(derive("/restaurants/12?photo=0").activePhotoId).toBeNull();
  });
});
