# CLAUDE.md — hosted GoHighLevel MCP bridge (fork)

> ⚠️ **This repository is PUBLIC.** Never commit secrets, tokens, sub-account ids, customer data or
> deployment-specific values here. Deployment specifics live in the owner's private notes
> (`~/Documents/Claude/CLAUDE.md`, `~/Documents/Cowork/memory/ghl.md`), not in this repo.

## What this is
The Vercel-hosted MCP bridge every AI surface uses to reach GoHighLevel. `vercel.json` routes
everything to `api/mcp-full.js` (`/mcp` = full tool set, `/mcp-gpt` = 128 schema-sanitised tools for
ChatGPT/Codex, `/health`), and `/mcp-legacy` to `api/index.js`. Tools come from the TypeScript
`ToolRegistry` in `src/` (built by `tsc` on deploy). Pushing to `main` deploys production.

## Single-bridge model (since v2.3.0, 2026-09-21)
One deployment, one URL, one token, every sub-account:

- **Credentials = keys mode.** One Private Integration per sub-account, one env var each:
  `GHL_KEY_<locationId>`. The legacy pair `GHL_API_KEY` + `GHL_LOCATION_ID` counts as one key, so
  adding a sub-account never means re-entering an existing key. `GHL_DEFAULT_LOCATION_ID` picks where
  calls land when no `locationId` is passed; `GHL_LOCATION_NAMES=id=Name,…` gives friendly names.
- **Agency mode is dormant — do not pursue it and do not set `GHL_AGENCY_KEY`.** It needs `oauth.write`,
  which GoHighLevel does not offer on Private Integrations (verified in the GHL UI 2026-09-21); setting
  the agency key flips the mode and every call 401s.
- **Access = `MCP_TOKEN`**, the one bearer all clients present. `MCP_ACCESS_TOKEN` (alias),
  `MCP_READ_TOKEN` and `MCP_READ_TOKEN_SCOPE` are still honoured for one release — remove them from the
  deployment once every client is on `MCP_TOKEN`.
- Every tool takes an optional `locationId` (id or name); `list_locations` shows what the deployment
  reaches. Tools that *require* `locationId`: reads default to the default sub-account, writes must
  name theirs.

Details: `docs/MULTI-LOCATION.md`, `api/locations.js`, `api/auth.js`.

## Working rules
- Commit as the Vercel team email (repo-local `user.email` is already set) — other authors make Vercel
  reject the deployment.
- Before pushing: `npx jest tests/mcp-auth.test.ts tests/locations.test.ts tests/confirmed-execution.test.ts --coverage=false`.
- After deploying, verify with a **real read in each sub-account** (`search_contacts {locationId, limit:1}`),
  not only `get_location`: a PIT with too few scopes passes `get_location` and fails everything else.
- Connectors cache `tools/list` at connect time; after a tool-surface change, disconnect/reconnect them.
