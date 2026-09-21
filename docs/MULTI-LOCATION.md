# One deployment, every sub-account

Since v2.2 the hosted bridge (`api/mcp-full.js`) is not tied to a single
sub-account. Credentials come from `api/locations.js`, which supports three
modes; the first one whose env vars are present wins.

| Mode | Env | What it does |
|------|-----|--------------|
| **agency** | `GHL_AGENCY_KEY`, `GHL_COMPANY_ID` | One agency-level Private Integration. Sub-accounts are discovered from `/locations/search`; a per-sub-account token is minted with `POST /oauth/locationToken` and cached until 5 min before expiry. The agency PIT must have the **`oauth.write`** scope or minting returns `401 The token is not authorized for this scope`. **As of 2026-09 GoHighLevel does not offer `oauth.write` on Private Integrations** (only Marketplace OAuth apps can exchange tokens), so this mode is dormant — use **keys**. |
| **keys** *(recommended)* | `GHL_KEY_<locationId>=pit-…` (one env var per sub-account) and/or `GHL_LOCATION_KEYS=locA=pit-…,locB=pit-…` | One sub-account PIT per location, no agency key. The legacy pair below also counts as a key, so an existing single-location deployment becomes multi-location by adding one `GHL_KEY_<otherLocationId>` — nothing already set has to be re-entered. Precedence when the same location appears twice: `GHL_KEY_<id>` > `GHL_LOCATION_KEYS` > legacy pair. |
| **legacy** | `GHL_API_KEY`, `GHL_LOCATION_ID` | The pre-v2.2 single-sub-account setup. |

Common to all modes:

- `GHL_DEFAULT_LOCATION_ID` — where a call lands when no `locationId` is given
  (falls back to `GHL_LOCATION_ID`, then the first known location).
- `GHL_LOCATION_IDS` — optional allowlist (agency mode).
- `GHL_LOCATION_NAMES=locA=TruTerra,…` — optional display names.

## What clients see

- A new tool, **`list_locations`**, returns the sub-accounts and the default.
- Every tool gains an optional **`locationId`** argument (id *or* name). The
  bridge resolves it, picks that sub-account's token, and forwards the id.
  Tools that already had a `locationId` keep their own schema.
- `GET /health` reports `credentialMode` and `defaultLocationId`.
- `/mcp-legacy` always acts in the default sub-account.
- Tools whose own schema *requires* `locationId` (`get_location`,
  `get_location_custom_values`, …): if the caller omits it, **reads** fall back
  to the default sub-account; **writes** are refused with a message asking for an
  explicit `locationId`, so a sub-account-level change never lands somewhere by default.

## Access tokens

`MCP_TOKEN` is the one bearer every client presents (full access). Pre-2.3 names
keep working so a deployment can switch without downtime: `MCP_ACCESS_TOKEN` is
an alias of `MCP_TOKEN`; `MCP_READ_TOKEN` is an optional second token that can
only call read tools unless `MCP_READ_TOKEN_SCOPE=admin` promotes it.

## Migrating from two deployments to one (keys mode)

1. Pick the surviving Vercel project. Leave its `GHL_API_KEY` / `GHL_LOCATION_ID`
   as they are.
2. For every other sub-account create a Private Integration *inside that
   sub-account* with the same scopes, and add it to the surviving project as
   `GHL_KEY_<locationId>` (production). Set `GHL_LOCATION_NAMES` and
   `GHL_DEFAULT_LOCATION_ID`. Redeploy.
3. Verify: `list_locations` → `mode: "keys"` with every sub-account; a read in
   each (`search_contacts {locationId, limit:1}`), not just `get_location` — a PIT
   with too few scopes passes `get_location` and fails everything else.
4. Point every client (Claude, ChatGPT, Codex) at the one URL with the one
   `MCP_TOKEN`. Connectors cache `tools/list` at connect time —
   disconnect/reconnect to pick up changes.
5. Retire the other deployment once nothing calls it.
