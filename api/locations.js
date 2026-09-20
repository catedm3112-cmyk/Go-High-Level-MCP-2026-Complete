// Location manager — one deployment, every sub-account.
//
// Three credential modes, picked from env in this order:
//
//   1. AGENCY  — GHL_AGENCY_KEY (agency-level Private Integration with
//                oauth.write) + GHL_COMPANY_ID. Sub-account tokens are minted
//                on demand via POST /oauth/locationToken and cached until
//                shortly before they expire. Sub-accounts are discovered from
//                /locations/search (or pinned with GHL_LOCATION_IDS).
//
//   2. KEYS    — GHL_LOCATION_KEYS="<locationId>=<pit>,<locationId>=<pit>".
//                One sub-account PIT per location, no agency key needed.
//                Optional GHL_LOCATION_NAMES="<locationId>=<name>,...".
//
//   3. LEGACY  — GHL_API_KEY + GHL_LOCATION_ID. Exactly the pre-2026-09 setup:
//                one sub-account, one key.
//
// GHL_DEFAULT_LOCATION_ID picks which sub-account a call lands in when the
// caller doesn't pass locationId (falls back to GHL_LOCATION_ID, then the
// first known location).

const GHL_BASE_URL = process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;   // refresh 5 min before expiry
const LOCATION_LIST_TTL_MS = 60 * 60 * 1000;     // re-discover sub-accounts hourly

function parsePairs(raw) {
  const out = {};
  for (const part of String(raw || "").split(",")) {
    const [k, ...rest] = part.split("=");
    const key = (k || "").trim();
    const value = rest.join("=").trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function detectMode() {
  if (process.env.GHL_AGENCY_KEY && process.env.GHL_COMPANY_ID) return "agency";
  if (process.env.GHL_LOCATION_KEYS) return "keys";
  if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) return "legacy";
  return "unconfigured";
}

async function ghlFetch(path, { method = "GET", token, body, form } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    Accept: "application/json",
  };
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${GHL_BASE_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text;
    throw new Error(`GHL ${method} ${path} → ${res.status}: ${Array.isArray(msg) ? msg.join("; ") : msg}`);
  }
  return data;
}

class LocationManager {
  constructor() {
    this.mode = detectMode();
    this._locations = null;          // [{ id, name }]
    this._locationsFetchedAt = 0;
    this._locationsPromise = null;
    this._tokens = new Map();        // locationId → { token, expiresAt }
    this._tokenPromises = new Map(); // locationId → in-flight mint
    this._registries = new Map();    // locationId → { client, registry, token }
    this._names = parsePairs(process.env.GHL_LOCATION_NAMES);
    this._keys = this.mode === "keys" ? parsePairs(process.env.GHL_LOCATION_KEYS) : {};
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  get defaultLocationId() {
    return (
      process.env.GHL_DEFAULT_LOCATION_ID ||
      process.env.GHL_LOCATION_ID ||
      (this._locations && this._locations[0] && this._locations[0].id) ||
      Object.keys(this._keys)[0] ||
      ""
    );
  }

  async listLocations() {
    if (this.mode === "unconfigured") {
      throw new Error(
        "No GHL credentials configured. Set GHL_AGENCY_KEY + GHL_COMPANY_ID (agency mode), " +
        "GHL_LOCATION_KEYS (per-location PITs), or GHL_API_KEY + GHL_LOCATION_ID (legacy)."
      );
    }
    const fresh = this._locations && Date.now() - this._locationsFetchedAt < LOCATION_LIST_TTL_MS;
    if (fresh) return this._locations;
    if (this._locationsPromise) return this._locationsPromise;

    this._locationsPromise = (async () => {
      let list;
      if (this.mode === "legacy") {
        const id = process.env.GHL_LOCATION_ID;
        list = [{ id, name: this._names[id] || id }];
      } else if (this.mode === "keys") {
        list = Object.keys(this._keys).map(id => ({ id, name: this._names[id] || id }));
      } else {
        list = await this._discoverAgencyLocations();
      }
      this._locations = list;
      this._locationsFetchedAt = Date.now();
      return list;
    })();

    try { return await this._locationsPromise; }
    finally { this._locationsPromise = null; }
  }

  async _discoverAgencyLocations() {
    const pinned = String(process.env.GHL_LOCATION_IDS || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    let discovered = [];
    try {
      const data = await ghlFetch(
        `/locations/search?companyId=${encodeURIComponent(process.env.GHL_COMPANY_ID)}&limit=100`,
        { token: process.env.GHL_AGENCY_KEY }
      );
      discovered = (data.locations || []).map(l => ({ id: l.id, name: l.name || l.id }));
    } catch (err) {
      if (!pinned.length && !(this._locations && this._locations.length)) throw err;
      process.stderr.write(`[locations] discovery failed, using pinned/cached list: ${err.message}\n`);
      discovered = this._locations || [];
    }
    if (pinned.length) {
      const byId = new Map(discovered.map(l => [l.id, l]));
      return pinned.map(id => byId.get(id) || { id, name: this._names[id] || id });
    }
    return discovered.map(l => ({ id: l.id, name: this._names[l.id] || l.name }));
  }

  async resolveLocationId(requested) {
    const list = await this.listLocations();
    const id = String(requested || "").trim() || this.defaultLocationId;
    if (!id) throw new Error("No default location configured (set GHL_DEFAULT_LOCATION_ID)");
    const known = list.find(l => l.id === id) ||
      list.find(l => l.name && l.name.toLowerCase() === id.toLowerCase());
    if (!known) {
      const options = list.map(l => `${l.name} (${l.id})`).join(", ");
      throw new Error(`Unknown locationId "${id}". Known sub-accounts: ${options}`);
    }
    return known.id;
  }

  // ── Tokens ─────────────────────────────────────────────────────────────────

  async getToken(locationId) {
    if (this.mode === "legacy") return process.env.GHL_API_KEY;
    if (this.mode === "keys") {
      const key = this._keys[locationId];
      if (!key) throw new Error(`No PIT configured for location ${locationId}`);
      return key;
    }
    const cached = this._tokens.get(locationId);
    if (cached && cached.expiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) return cached.token;
    if (this._tokenPromises.has(locationId)) return this._tokenPromises.get(locationId);

    const p = (async () => {
      const data = await ghlFetch("/oauth/locationToken", {
        method: "POST",
        token: process.env.GHL_AGENCY_KEY,
        form: { companyId: process.env.GHL_COMPANY_ID, locationId },
      });
      if (!data.access_token) throw new Error("locationToken response had no access_token");
      const ttlSec = Number(data.expires_in) > 0 ? Number(data.expires_in) : 23 * 3600;
      const entry = { token: data.access_token, expiresAt: Date.now() + ttlSec * 1000 };
      this._tokens.set(locationId, entry);
      return entry.token;
    })();
    this._tokenPromises.set(locationId, p);
    try { return await p; }
    finally { this._tokenPromises.delete(locationId); }
  }

  // ── Registries ─────────────────────────────────────────────────────────────

  async getRegistry(locationId) {
    const id = await this.resolveLocationId(locationId);
    const token = await this.getToken(id);
    let entry = this._registries.get(id);
    if (!entry) {
      const { GHLApiClient } = require("../dist/clients/ghl-api-client.js");
      const { ToolRegistry } = require("../dist/tool-registry.js");
      const client = new GHLApiClient({
        accessToken: token,
        baseUrl: GHL_BASE_URL,
        version: GHL_VERSION,
        locationId: id,
      });
      entry = { client, registry: new ToolRegistry(client), token };
      this._registries.set(id, entry);
    } else if (entry.token !== token) {
      entry.client.updateAccessToken(token);
      entry.token = token;
    }
    return entry.registry;
  }

  // Legacy /mcp-legacy handler: token + id for the default location.
  async getDefaultCredentials() {
    const id = await this.resolveLocationId();
    return { locationId: id, token: await this.getToken(id) };
  }

  describe() {
    return {
      mode: this.mode,
      defaultLocationId: this.defaultLocationId || null,
      locations: this._locations || null,
    };
  }
}

let _manager = null;
function getLocationManager() {
  if (!_manager) _manager = new LocationManager();
  return _manager;
}

module.exports = { getLocationManager, LocationManager, detectMode };
