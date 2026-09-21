const { detectMode, collectKeys, LocationManager } = require("../api/locations.js");

describe("credential modes", () => {
  it("stays legacy with only the legacy pair", () => {
    const env = { GHL_API_KEY: "pit-a", GHL_LOCATION_ID: "locA" };
    expect(detectMode(env)).toBe("legacy");
  });

  it("switches to keys mode as soon as a per-location key is added", () => {
    const env = { GHL_API_KEY: "pit-a", GHL_LOCATION_ID: "locA", GHL_KEY_locB: "pit-b" };
    expect(detectMode(env)).toBe("keys");
    expect(collectKeys(env)).toEqual({ locA: "pit-a", locB: "pit-b" });
  });

  it("merges GHL_LOCATION_KEYS and GHL_KEY_<id>, the per-location var winning", () => {
    const env = {
      GHL_LOCATION_KEYS: "locA=pit-a, locB=pit-b-old",
      GHL_KEY_locB: "pit-b-new",
      GHL_KEY_locC: " pit-c ",
      GHL_KEY_: "ignored",
      GHL_KEY_locD: "",
    };
    expect(detectMode(env)).toBe("keys");
    expect(collectKeys(env)).toEqual({ locA: "pit-a", locB: "pit-b-new", locC: "pit-c" });
  });

  it("prefers agency mode when the agency pair is present", () => {
    expect(detectMode({ GHL_AGENCY_KEY: "pit-x", GHL_COMPANY_ID: "co", GHL_KEY_locB: "pit-b" })).toBe("agency");
  });

  it("reports unconfigured with nothing set", () => {
    expect(detectMode({})).toBe("unconfigured");
  });
});

describe("LocationManager in keys mode", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("lists every keyed sub-account, resolves names, and hands out the right PIT", async () => {
    process.env = {
      ...saved,
      GHL_API_KEY: "pit-a",
      GHL_LOCATION_ID: "locA",
      GHL_KEY_locB: "pit-b",
      GHL_LOCATION_NAMES: "locA=Alpha,locB=Bravo",
      GHL_DEFAULT_LOCATION_ID: "locA",
    };
    delete process.env.GHL_AGENCY_KEY;
    const manager = new LocationManager();
    expect(manager.mode).toBe("keys");
    expect(await manager.listLocations()).toEqual([
      { id: "locA", name: "Alpha" },
      { id: "locB", name: "Bravo" },
    ]);
    expect(await manager.resolveLocationId("bravo")).toBe("locB");
    expect(await manager.resolveLocationId()).toBe("locA");
    expect(await manager.getToken("locB")).toBe("pit-b");
    await expect(manager.resolveLocationId("nope")).rejects.toThrow(/Unknown locationId/);
  });
});
