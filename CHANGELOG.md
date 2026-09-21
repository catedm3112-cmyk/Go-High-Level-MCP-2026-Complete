# Changelog

All notable changes to the GoHighLevel MCP Server are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [2.3.3] — 2026-09-21 (hosted bridge) — SECURITY: cross-sub-account routing

### Fixed
- **Workflow-builder tools ignored `locationId`.** `ghl_create_workflow`, `ghl_list_workflows_full`,
  `ghl_get_workflow_full`, `ghl_update_workflow_actions`, `ghl_publish_workflow`, `ghl_clone_workflow` and
  `ghl_delete_workflow` built their client from `process.env` (`GHL_API_KEY` + `GHL_LOCATION_ID`) instead of the
  registry's per-sub-account client, so in a multi-location deployment every call — writes included — went to the
  **default** sub-account. They are now bound to the sub-account of the registry that owns them, follow a rotated
  key without a restart, and **refuse** (nothing sent) if asked to act in a sub-account they are not bound to.
- Removed the hard-coded fallback location/user ids in `WorkflowBuilderClient.fromEnv()` (a third party's
  sub-account): with no location configured the tools now fail instead of guessing.
- `ghl_delete_workflow` was defined by two modules and listed twice; the executing definition is the only one listed.
- `ghl_list_workflows`: GHL's `GET /workflows/` accepts `locationId` only (422 "property limit should not exist");
  `status` / `limit` / `skip` are now applied to the result locally.

### Tests
- `tests/workflow-builder-routing.test.ts`: every builder tool × (explicit id, no id, mismatched id), rotated key,
  no-fallback, and the `ghl_list_workflows` query.

---

## [2.3.2] — 2026-09-21 (hosted bridge)

### Added
- MCP **tool annotations** on every tool (`readOnlyHint`, `destructiveHint`, `openWorldHint`). Clients stop treating
  lookups as destructive writes: ChatGPT no longer asks for confirmation on reads, claude.ai can allow read-only
  tools separately. Conservative: `crm_prepare_*` counts as a write; only create/add/send-style tools are non-destructive.
- Protocol revision `2025-11-25` (what ChatGPT requests) is answered as such.

---

## [2.3.1] — 2026-09-21 (hosted bridge)

### Fixed
- JSON-RPC **notifications** (`notifications/initialized`, …) are acknowledged with `202` and an empty body.
  They used to be answered with a `Method not found` error carrying `id: null`, which strict Streamable-HTTP
  clients (ChatGPT) treat as a failed handshake — the connector saved but listed no tools.
- `initialize` answers with the protocol revision the client requested (`2025-06-18`, `2025-03-26`,
  `2024-11-05`) instead of always `2024-11-05`.
- `/mcp-gpt`: validation-only schema keywords (`minimum`, `maximum`, `maxLength`, `format`,
  `additionalProperties`, …) are dropped, objects always carry `properties`, untyped leaves become strings.

### Added
- One log line per call (endpoint, JSON-RPC method, tool name, client name — never arguments or tokens).

---

## [2.3.0] — 2026-09-21 (hosted bridge)

### Added
- **Per-sub-account keys:** `GHL_KEY_<locationId>=<pit>` — one env var per sub-account. Works together with
  `GHL_LOCATION_KEYS`; the legacy `GHL_API_KEY` + `GHL_LOCATION_ID` pair now counts as one key, so a
  single-location deployment becomes multi-location by adding one variable.
- **`MCP_TOKEN`:** the single bearer for every client. `MCP_ACCESS_TOKEN`, `MCP_READ_TOKEN` and
  `MCP_READ_TOKEN_SCOPE` remain accepted for one release.

### Fixed
- Calls that omitted `locationId` broke every tool whose schema requires it (`get_location`,
  `get_location_custom_values`, `get_location_custom_fields`, `get_location_tags`, …): the bridge stripped
  the argument and the request reached GHL as `/locations/undefined` → 401. Reads now fall back to the
  default sub-account; writes that require `locationId` ask for it explicitly.

### Docs
- Agency mode marked dormant: GoHighLevel does not offer `oauth.write` on Private Integrations.

---

## [1.0.0] — 2026-01-15

### Added — 520+ Tools across 40 categories

#### Contact Management (31 tools)
- `create_contact`, `get_contact`, `update_contact`, `delete_contact`, `search_contacts`
- `list_contacts`, `add_contact_tag`, `remove_contact_tag`, `bulk_update_contacts`
- Full contact lifecycle: notes, tasks, appointments, activities
- Contact merge, DND (do-not-disturb) management, custom field updates

#### Messaging & Conversations (20 tools)
- `send_sms`, `send_email`, `send_whatsapp`, `list_conversations`, `get_conversation`
- `create_conversation`, `update_conversation`, `delete_conversation`
- Message history, read receipts, conversation assignment

#### Opportunity Management (10 tools)
- `create_opportunity`, `get_opportunity`, `update_opportunity`, `delete_opportunity`
- `list_opportunities`, `move_opportunity_stage`, `get_pipelines`
- Pipeline management, stage transitions, deal value tracking

#### Calendar & Appointments (14 tools)
- `create_appointment`, `get_appointment`, `update_appointment`, `delete_appointment`
- `list_appointments`, `get_calendar_slots`, `list_calendars`
- Availability checking, recurring appointments, staff assignment

#### Blog Management (7 tools)
- `list_blog_posts`, `get_blog_post`, `create_blog_post`, `update_blog_post`, `delete_blog_post`
- `list_blog_categories`, `get_blog_authors`
- Full CMS: SEO fields, scheduling, category management

#### Email Marketing (5 tools)
- `list_email_campaigns`, `get_email_campaign`, `create_email_campaign`
- `update_email_campaign`, `delete_email_campaign`

#### Location Management (24 tools)
- Full sub-account configuration, business info, timezone, logo
- Social media links, payment gateway settings, custom values
- Snapshot management, location onboarding

#### Social Media Management (17 tools)
- `list_social_posts`, `create_social_post`, `schedule_social_post`
- `delete_social_post`, `get_social_accounts`, `list_social_categories`
- Multi-platform posting: Facebook, Instagram, LinkedIn, Twitter/X, GMB

#### Store Management (18 tools)
- `list_products`, `create_product`, `update_product`, `delete_product`
- `list_orders`, `get_order`, `update_order`, `list_coupons`, `create_coupon`
- E-commerce: inventory, fulfillment, discount codes

#### Payments Management (20 tools)
- `list_transactions`, `get_transaction`, `list_subscriptions`
- `create_payment_link`, `list_payment_integrations`
- Stripe integration, text2pay links, subscription management

#### Invoices & Billing (39 tools)
- Full invoice lifecycle: create, send, update, delete, mark paid
- Estimates, recurring billing, payment schedules
- Templates, line items, tax management

#### Voice AI (11 tools)
- `list_voice_agents`, `create_voice_agent`, `update_voice_agent`
- `list_voice_calls`, `get_voice_call`
- AI phone agents, call routing, voicemail

#### Custom Objects (9 tools)
- `list_objects`, `get_object`, `create_object_record`, `update_object_record`
- `delete_object_record`, `list_object_records`

#### Association Management (10 tools)
- Object-to-object associations, relationship mapping
- `create_association`, `delete_association`, `list_associations`

#### Custom Fields V2 (8 tools)
- `list_custom_fields`, `create_custom_field`, `update_custom_field`, `delete_custom_field`
- Field options, conditional logic, field grouping

#### Workflow Management (1 tool)
- `list_workflows` — enumerate all automations

#### Workflow Builder (7 tools)
- Create and manage workflow nodes, triggers, actions

#### Survey Management (2 tools)
- `list_surveys`, `get_survey_submissions`

#### Media Library (3 tools)
- `list_media_files`, `upload_media_file`, `delete_media_file`

#### Custom Menus (5 tools)
- White-label menu customization for sub-accounts

#### Marketplace & Billing (7 tools)
- `list_marketplace_installations`, `delete_marketplace_installation`
- App billing, subscription management, usage tracking

#### Phone System (2 tools)
- `list_phone_numbers`, `get_phone_number`

#### Proposals & Documents (4 tools)
- `list_documents`, `get_document`, `send_document`

---

### Infrastructure

- **MCP SDK**: `@modelcontextprotocol/sdk` v1.27.1 — 2025-11-25 spec compliance
- **Transports**: Stdio (Claude Desktop) + Streamable HTTP (Vercel/Railway)
- **Auth**: GoHighLevel Private Integrations API v2 (Bearer token)
- **Error handling**: Retry with exponential backoff, circuit breaker pattern
- **Rate limiting**: Automatic detection and wait on 429 responses
- **TypeScript**: Strict mode, full type definitions for all GHL API shapes
- **Testing**: Jest test suite with integration tests
- **Deployment**: Vercel, Railway, Render, Docker — all supported

### Documentation

- Full README with 500+ lines of examples and setup guides
- Claude Desktop and Cursor configuration snippets
- Deployment guides for all platforms
- Tool catalog with 520+ tools indexed by category
- Signet integration guide (SIGNET.md)

---

## [0.9.0] — 2025-12-01 (Original release by @mastanley13)

### Added
- Foundation MCP server for GoHighLevel
- Contact, conversation, and opportunity tools
- Basic Claude Desktop integration
- Initial deployment support

---

*Extended to 520+ tools by [@BusyBee3333](https://github.com/BusyBee3333)*
