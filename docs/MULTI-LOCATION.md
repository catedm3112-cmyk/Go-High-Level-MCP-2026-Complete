# One deployment, every sub-account

Since v2.2 the hosted bridge (`api/mcp-full.js`) is not tied to a single
sub-account. Credentials come from `api/locations.js`, which supports three
modes; the first one whose env vars are present wins.

| Mode | Env | What it does |
|------|-----|--------------|
| **agency** | `GHL_AGENCY_KEY`, `GHL_COMPANY_ID` | One agency-level Private Integration. Sub-accounts are discovered from `/locations/search`; a per-sub-account token is minted with `POST /oauth/locationToken` and cached until 5 min before expiry. The agency PIT must have the **`oauth.write`** scope or minting returns `401 The token is not authorized for this scope`. |
| **keys** | `GHL_LOCATION_KEYS=locA=pit-…,locB=pit-…` | One sub-account PIT per location, no agency key. |
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

## Access tokens

`MCP_ACCESS_TOKEN` is the bearer clients present. `MCP_READ_TOKEN` is an
optional second token that is read-only unless `MCP_READ_TOKEN_SCOPE=admin`.
For a single-operator deployment set `MCP_READ_TOKEN_SCOPE=admin` (or drop the
read token) so every connector has the same capability.

## Migrating from two deployments

1. Create/edit the agency Private Integration: add `oauth.write` plus the
   sub-account scopes you use (contacts, conversations, opportunities, …).
2. On the Vercel project set `GHL_AGENCY_KEY`, `GHL_COMPANY_ID`,
   `GHL_DEFAULT_LOCATION_ID`; remove `GHL_API_KEY` / `GHL_LOCATION_ID`.
3. Redeploy, then `curl -H "Authorization: Bearer $MCP_ACCESS_TOKEN" …/mcp`
   with `{"method":"tools/call","params":{"name":"list_locations"}}`.
4. Point every client (Claude, ChatGPT, Claude Code) at the one URL. Connectors
   cache `tools/list` at connect time — disconnect/reconnect to pick up the
   `locationId` argument.
