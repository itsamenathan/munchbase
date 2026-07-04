import { describe, expect, it } from "vitest";
import { buildPhotonAddress, mapPhotonFeature } from "./photon";

describe("photon helpers", () => {
  it("builds a readable address from Photon properties", () => {
    expect(buildPhotonAddress({
      housenumber: "123",
      street: "Main St",
      city: "New York",
      state: "NY",
      postcode: "10001",
      country: "United States",
    })).toBe("123 Main St, New York, NY, 10001, United States");
  });

  it("maps Photon features to place search results", () => {
    const result = mapPhotonFeature({
      geometry: { coordinates: [-73.98, 40.75] },
      properties: {
        osm_type: "N",
        osm_id: 123,
        name: "Best Bagels",
        street: "Broadway",
        city: "New York",
      },
    });

    expect(result).toMatchObject({
      osmType: "node",
      osmId: "123",
      name: "Best Bagels",
      address: "Broadway, New York",
      lat: "40.75",
      lon: "-73.98",
    });
  });
});
