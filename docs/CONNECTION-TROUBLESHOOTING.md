# Hosted connection troubleshooting

Use one existing deployment for all subaccounts. Keep the client's connection
credential separate from the credentials that the server uses to call GoHighLevel.

## Server configuration

In the selected Vercel project's production environment, configure:

- `MCP_TOKEN`: the secret clients present to this bridge.
- `GHL_KEY_<locationId>`: a Private Integration key created inside each subaccount.
- `GHL_DEFAULT_LOCATION_ID`: the default subaccount's ID.
- `GHL_LOCATION_NAMES`: optional comma-separated `id=Name` pairs.

Use keys mode for Private Integrations. Do not set the agency credential pair:
agency mode takes precedence and needs `oauth.write`, which is not available on
these Private Integrations. Redeploy after changing environment variables.

## Client configuration

Use the selected deployment's HTTPS URL with `/mcp` for the full tool surface,
or `/mcp-gpt` for the curated ChatGPT surface. Authenticate with the bridge's
`MCP_TOKEN`, via `Authorization: Bearer <token>` or `X-MCP-Access-Token`.
The server also accepts a `key` query parameter for clients that cannot set
headers; URLs containing this secret must be kept out of logs and shared notes.

The bridge implements static token authentication, not an OAuth authorization
server. A client configured to perform OAuth login cannot complete that flow
against this server. Use that client's supported static-token connection mode.
Do not substitute a GoHighLevel Private Integration key for the bridge token.
Reconnect clients after tool descriptions or schemas change, since clients can
cache `tools/list`.

## Verify the connection

`GET /health` identifies the running commit and credential mode. A healthy
response alone does not establish API access. Run `list_locations`, then a
`search_contacts` read with `limit: 1` in each subaccount. Do not use outbound
messages or workflow enrollment to test authentication.

## API failures

| Operation | Supported behavior |
| --- | --- |
| Phone listing | `GET /phone-system/numbers/location/{locationId}` with `Version: v3`; requires `phonenumbers.read`. The v3 response contains its payload and pagination under `data`. |
| Funnel listing | `GET /funnels/funnel/list`; translate the tool's `skip` argument to `offset`. Requires `funnels/funnel.readonly`. |
| Workflow listing | `GET /workflows/?locationId=…`; filtering and pagination happen locally. |
| Full workflow details | Not provided by the public workflow API. Use the separately configured internal API tooling, or Automation → Workflows in GoHighLevel. |

A `401` from this bridge indicates a rejected client credential. A GHL error
embedded in a tool result comes from a separate authentication boundary.
In particular, GHL's “route is not yet supported by the IAM Service” response
on an incorrectly mapped route is not proof that the credential needs broader
scopes. Correct the route first, then check the actual response.

Official references:

- [Active phone numbers](https://marketplace.gohighlevel.com/docs/ghl/phone-system/active-numbers/)
- [Funnel listing](https://marketplace.gohighlevel.com/docs/ghl/funnels/get-funnels/)
- [API scopes](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/)
