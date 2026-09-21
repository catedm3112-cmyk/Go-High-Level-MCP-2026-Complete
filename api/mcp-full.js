// GHL MCP Server v2.3 — 552 tools via TypeScript ToolRegistry, every sub-account
// behind one URL (see api/locations.js for the credential modes).
// Handles: /mcp (Streamable HTTP), /sse (SSE transport), /mcp-full (alias)
//
// /mcp-legacy and /sse-legacy still route to api/index.js for rollback.

const MCP_PROTOCOL_VERSION = "2024-11-05";
// This server only does request → JSON response for tools, which is valid in every
// revision below, so it answers with the revision the client asked for (the spec
// requires that when it is supported); unknown revisions get the newest one we know.
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
function negotiateProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
}
const SERVER_INFO = { name: "ghl-mcp-server", version: "2.3.1" };
const {
  authorizeRequest,
  isReadOnlyTool,
  rejectUnauthorized,
  setSecurityHeaders,
} = require("./auth.js");
const { getLocationManager } = require("./locations.js");
const {
  executeConfirmedWorkflow,
  isConfirmedExecutionRequest,
} = require("./confirmed-execution.js");

// ─── GPT-compatible tool allowlist (exactly 128 tools) ───────────────────────────
// ChatGPT enforces a hard cap of ~128 tools per MCP server. This hand-picked
// set covers the most impactful GHL workflows across every major category.
// The /mcp-gpt endpoint serves only these tools; /mcp is unchanged and still
// serves all 552 tools for Claude and other uncapped clients.

const GPT_TOOL_ALLOWLIST = new Set([
  // Contacts (20) — full CRUD + notes, tasks, appointments, workflows, campaigns
  "search_contacts", "get_contact", "create_contact", "update_contact", "delete_contact",
  "upsert_contact", "add_contact_tags", "remove_contact_tags",
  "get_contact_notes", "create_contact_note", "update_contact_note",
  "get_contact_tasks", "create_contact_task", "update_contact_task",
  "get_contact_appointments",
  "add_contact_to_workflow", "remove_contact_from_workflow",
  "add_contact_to_campaign", "remove_contact_from_all_campaigns", "remove_contact_from_campaign",

  // Conversations / Messaging (9)
  "search_conversations", "get_conversation", "create_conversation",
  "get_messages", "get_message", "send_sms", "send_email",
  "update_conversation", "get_recent_messages",

  // Opportunities / Pipeline (8)
  "search_opportunities", "get_opportunity", "create_opportunity", "update_opportunity",
  "delete_opportunity", "get_pipelines", "update_opportunity_status", "upsert_opportunity",

  // Calendars / Appointments (12)
  "get_calendars", "get_calendar", "create_calendar", "update_calendar", "delete_calendar",
  "get_calendar_events", "get_free_slots",
  "create_appointment", "get_appointment", "update_appointment", "delete_appointment",
  "get_calendar_groups",

  // Voice AI (4)
  "list_voice_ai_agents", "create_voice_ai_agent", "get_voice_ai_agent", "update_voice_ai_agent",

  // Funnels (3)
  "get_funnels", "get_funnel", "get_funnel_pages",

  // Custom Fields CRUD (3) — extends get_location_custom_fields already in Location/Users
  "create_location_custom_field", "update_location_custom_field", "delete_location_custom_field",

  // Phone Numbers (2)
  "get_phone_numbers", "ghl_search_available_numbers",

  // Products / Store (10)
  "ghl_list_products", "ghl_get_product", "ghl_create_product", "ghl_update_product", "ghl_delete_product",
  "ghl_list_prices", "ghl_create_price",
  "list_coupons", "create_coupon", "update_coupon",

  // Workflows (5)
  "ghl_get_workflows", "ghl_get_workflow", "ghl_trigger_workflow",
  "ghl_list_workflows", "ghl_update_workflow_status",

  // Campaigns (5)
  "get_campaigns", "get_campaign", "start_campaign", "pause_campaign", "resume_campaign",

  // Location / Users (14)
  "get_location", "update_location",
  "get_location_custom_fields", "get_location_tags", "create_location_tag", "update_location_tag",
  "get_location_custom_values", "create_location_custom_value", "update_location_custom_value",
  "get_users", "get_user", "search_users", "create_user", "update_user",

  // Smart Lists (2)
  "get_smart_lists", "get_smart_list_contacts",

  // Snippets (2)
  "get_snippets", "create_snippet",

  // Social Media (6)
  "get_social_accounts", "create_social_post", "update_social_post",
  "get_social_post", "delete_social_post", "get_social_media_statistics",

  // Companies / Businesses (4)
  "get_companies", "get_company", "create_company", "update_company",

  // Email / Templates (4)
  "get_email_templates", "create_email_template", "get_email_campaigns", "get_sms_templates",

  // Forms / Surveys (3)
  "get_forms", "get_form_submissions", "ghl_get_surveys",

  // Reporting (4)
  "get_pipeline_reports", "get_dashboard_stats", "get_email_reports", "get_funnel_reports",

  // Reputation / Reviews (3)
  "get_reviews", "reply_to_review", "send_review_request",

  // Misc high-value (5)
  "get_media_files", "get_webhooks", "create_webhook", "get_snapshots", "get_location_templates",
]);

// ─── Registry (one per sub-account, via the location manager) ─────────────────

const locations = getLocationManager();

function getRegistry(locationId) {
  return locations.getRegistry(locationId);
}

const LIST_LOCATIONS_TOOL = {
  name: "list_locations",
  description:
    "List the GoHighLevel sub-accounts this server can act in, with the default. " +
    "Pass any tool a `locationId` (id or name) to act in a specific sub-account.",
  inputSchema: { type: "object", properties: {} },
};

async function locationSchemaDescription() {
  const list = await locations.listLocations();
  const def = locations.defaultLocationId;
  const opts = list.map(l => `${l.name} = ${l.id}${l.id === def ? " (default)" : ""}`).join("; ");
  return `Sub-account to act in (id or name). ${opts}`;
}

// Every tool gets a `locationId` argument so one connector can address any
// sub-account. Tools that already declare one keep their own schema.
function withLocationArg(tool, description) {
  const schema = tool.inputSchema && typeof tool.inputSchema === "object"
    ? tool.inputSchema
    : { type: "object", properties: {} };
  const props = { ...(schema.properties || {}) };
  if (!props.locationId) props.locationId = { type: "string", description };
  return { ...tool, inputSchema: { ...schema, properties: props } };
}

async function listToolDefinitions(registry, filter) {
  const description = await locationSchemaDescription();
  const all = registry.getAllToolDefinitions([]);
  const defs = filter ? all.filter(filter) : all;
  return [LIST_LOCATIONS_TOOL, ...defs].map(t => withLocationArg(t, description));
}

// Tools whose own schema marks `locationId` as required (get_location,
// get_location_custom_values, ...) have no built-in default, so a call that omits
// it used to reach GHL as /locations/undefined → 401.
const _requiresLocation = new WeakMap(); // registry → Set<toolName>
function requiresLocationId(registry, name) {
  let names = _requiresLocation.get(registry);
  if (!names) {
    names = new Set(
      registry.getAllToolDefinitions([])
        .filter(t => (t.inputSchema?.required || []).includes("locationId"))
        .map(t => t.name)
    );
    _requiresLocation.set(registry, names);
  }
  return names.has(name);
}

async function callListLocations() {
  const list = await locations.listLocations();
  const def = locations.defaultLocationId;
  return {
    mode: locations.mode,
    defaultLocationId: def,
    locations: list.map(l => ({ ...l, default: l.id === def })),
  };
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function rpc(id, result, error) {
  const base = { jsonrpc: "2.0", id: id ?? null };
  return error ? { ...base, error } : { ...base, result };
}

// ─── MCP message processor ────────────────────────────────────────────────────

// scope: "admin" | "read" (from auth). toolFilter: optional allowlist predicate
// (used by /mcp-gpt). The registry is chosen per call from args.locationId.
async function processMessage(msg, scope = "admin", toolFilter = null) {
  const readOnly = scope === "read";
  switch (msg.method) {
    case "initialize":
      return rpc(msg.id, {
        protocolVersion: negotiateProtocolVersion(msg.params?.protocolVersion),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "tools/list": {
      const registry = await getRegistry();
      const filter = t =>
        (!toolFilter || toolFilter(t)) && (!readOnly || isReadOnlyTool(t.name));
      const defs = await listToolDefinitions(registry, filter);
      return rpc(msg.id, {
        tools: defs.map(t => ({
          name: t.name,
          description: t.description || "",
          inputSchema: t.inputSchema || { type: "object", properties: {} },
        })),
      });
    }

    case "tools/call": {
      const { name, arguments: args } = msg.params || {};
      if (!name) return rpc(msg.id, null, { code: -32602, message: "Missing tool name" });
      const confirmedExecution = isConfirmedExecutionRequest(name, args);
      if (readOnly && name !== LIST_LOCATIONS_TOOL.name &&
          (!isReadOnlyTool(name) || confirmedExecution))
        return rpc(msg.id, null, { code: -32001, message: `Tool ${name} requires the admin token` });
      try {
        if (name === LIST_LOCATIONS_TOOL.name) {
          const text = JSON.stringify(await callListLocations(), null, 2);
          return rpc(msg.id, { content: [{ type: "text", text }] });
        }
        const callArgs = { ...(args || {}) };
        const targetLocation = await locations.resolveLocationId(callArgs.locationId);
        const registry = await getRegistry(targetLocation);
        // Normalise a name ("TruTerra") to the id the API expects. When the caller
        // didn't ask, leave it out so each tool's own default applies — except for
        // tools that require it: reads fall back to the default sub-account, writes
        // must name theirs (a sub-account-level change never lands somewhere by default).
        if (callArgs.locationId) callArgs.locationId = targetLocation;
        else {
          delete callArgs.locationId;
          if (requiresLocationId(registry, name)) {
            if (!isReadOnlyTool(name))
              return rpc(msg.id, {
                content: [{ type: "text", text: `Error: ${name} changes sub-account-level data — pass locationId explicitly (see list_locations).` }],
                isError: true,
              });
            callArgs.locationId = targetLocation;
          }
        }
        let result = await registry.callTool(name, callArgs);
        if (result === undefined)
          return rpc(msg.id, null, { code: -32601, message: `Tool not found: ${name}` });
        if (confirmedExecution) result = await executeConfirmedWorkflow(registry, result);
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return rpc(msg.id, { content: [{ type: "text", text }] });
      } catch (err) {
        return rpc(msg.id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    }

    case "ping":
      return rpc(msg.id, {});

    default:
      return rpc(msg.id, null, { code: -32601, message: `Method not found: ${msg.method}` });
  }
}

// JSON-RPC notifications (no id) get 202 + empty body, as Streamable HTTP requires.
// Answering them with a JSON-RPC error (the pre-2.3.1 behaviour) makes strict clients
// such as ChatGPT treat the handshake as failed and show no tools.
function isNotification(msg) {
  return msg && !Array.isArray(msg) && msg.id === undefined && typeof msg.method === "string";
}

// One line per call: endpoint, method, tool name. Never arguments (customer data) or tokens.
function logCall(endpoint, req, msg, extra = {}) {
  try {
    console.log(JSON.stringify({
      ep: endpoint, method: msg?.method, tool: msg?.params?.name,
      client: msg?.params?.clientInfo?.name, proto: msg?.params?.protocolVersion,
      ua: String(req.headers?.["user-agent"] || "").slice(0, 60), ...extra,
    }));
  } catch { /* logging must never break a request */ }
}

// ─── CORS & SSE helpers ───────────────────────────────────────────────────────

function sendSSE(res, data) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  res.write(`data: ${msg}\n\n`);
}

function sendSSEEvent(res, event, data) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${msg}\n\n`);
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// Health / root
async function handleHealth(req, res) {
  res.status(200).json({
    status: "healthy",
    server: SERVER_INFO.name,
    version: SERVER_INFO.version,
    authRequired: true,
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
    credentialMode: locations.mode,
    defaultLocationId: locations.defaultLocationId || null,
  });
}

// /mcp — Streamable HTTP (GET=discovery, POST=JSON-RPC)
async function handleMcp(req, res) {
  if (req.method === "GET") {
    try {
      const registry = await getRegistry();
      res.status(200).json({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: MCP_PROTOCOL_VERSION,
        endpoint: "POST /mcp",
        toolCount: registry.getToolCount(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      let msg;
      try { msg = JSON.parse(body); }
      catch { res.status(400).json(rpc(null, null, { code: -32700, message: "Parse error" })); return; }

      logCall("/mcp", req, msg);
      if (isNotification(msg)) { res.status(202).end(); return; }

      try {
        const response = await processMessage(msg, req.mcpScope);
        res.status(200).setHeader("Content-Type", "application/json").end(JSON.stringify(response));
      } catch (err) {
        res.status(500).json(rpc(msg.id, null, { code: -32603, message: err.message }));
      }
    });
  }
}

// /sse — SSE transport (GET=connection, POST=JSON-RPC over SSE)
async function handleSse(req, res) {
  if (req.method === "GET") {
    res.writeHead(200, {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    });

    sendSSEEvent(res, "endpoint", "/sse");

    const hb = setInterval(() => res.write(": heartbeat\n\n"), 25000);
    req.on("close", () => clearInterval(hb));
    req.on("error", () => clearInterval(hb));
    // Vercel 50-second function limit
    setTimeout(() => { clearInterval(hb); res.end(); }, 48000);
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      let msg;
      try { msg = JSON.parse(body); }
      catch {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        sendSSE(res, rpc(null, null, { code: -32700, message: "Parse error" }));
        res.end();
        return;
      }

      try {
        const response = await processMessage(msg, req.mcpScope);
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        sendSSE(res, response);
        setTimeout(() => res.end(), 100);
      } catch (err) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        sendSSE(res, rpc(msg.id, null, { code: -32603, message: err.message }));
        res.end();
      }
    });
  }
}

// ─── Schema sanitizer for ChatGPT ────────────────────────────────────────────
// ChatGPT's MCP client rejects schemas with:
//   - `default` keyword in property definitions
//   - `type: "array"` properties without an `items` sub-schema
// and is strict about shape in general, so validation-only keywords (they tell the model
// nothing the description doesn't) are dropped, objects always carry `properties`, and a
// leaf with no type at all is presented as a string.
const GPT_DROPPED_KEYWORDS = new Set([
  "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength",
  "minItems", "maxItems", "pattern", "format", "additionalProperties", "$schema",
]);

function sanitizeSchemaForGPT(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;

  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (GPT_DROPPED_KEYWORDS.has(key)) continue;

    if (key === "properties" && value && typeof value === "object") {
      result.properties = {};
      for (const [prop, propSchema] of Object.entries(value)) {
        result.properties[prop] = sanitizeSchemaForGPT(propSchema);
      }
    } else if (key === "items") {
      result.items = sanitizeSchemaForGPT(value);
    } else if ((key === "anyOf" || key === "oneOf" || key === "allOf") && Array.isArray(value)) {
      result[key] = value.map(s => sanitizeSchemaForGPT(s));
    } else {
      result[key] = value;
    }
  }

  // GPT requires `items` for any array-typed property
  if (result.type === "array" && !result.items) {
    result.items = {};
  }
  if (result.type === "object" && !result.properties) result.properties = {};
  const untyped = !result.type && !result.enum && !result.properties && !result.items &&
    !result.anyOf && !result.oneOf && !result.allOf;
  if (untyped && Object.keys(result).length) result.type = "string";

  return result;
}

// /mcp-gpt — ChatGPT-compatible endpoint (128 curated tools, schema-sanitized)
async function handleMcpGpt(req, res) {
  if (req.method === "GET") {
    try {
      const registry = await getRegistry();
      const allDefs = registry.getAllToolDefinitions([]);
      const filtered = allDefs.filter(t => GPT_TOOL_ALLOWLIST.has(t.name));
      res.status(200).json({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: MCP_PROTOCOL_VERSION,
        endpoint: "POST /mcp-gpt",
        toolCount: filtered.length,
        note: "ChatGPT-compatible endpoint — 128 curated best-in-class GHL tools",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      let msg;
      try { msg = JSON.parse(body); }
      catch { res.status(400).json(rpc(null, null, { code: -32700, message: "Parse error" })); return; }

      if (isNotification(msg)) { logCall("/mcp-gpt", req, msg); res.status(202).end(); return; }

      try {
        let response = await processMessage(msg, req.mcpScope, t => GPT_TOOL_ALLOWLIST.has(t.name));
        if (msg.method === "tools/list" && response.result?.tools) {
          response.result.tools = response.result.tools.map(t => ({
            ...t,
            inputSchema: sanitizeSchemaForGPT(t.inputSchema) || { type: "object", properties: {} },
          }));
        }
        logCall("/mcp-gpt", req, msg, { tools: response.result?.tools?.length, error: response.error?.message });
        res.status(200).setHeader("Content-Type", "application/json").end(JSON.stringify(response));
      } catch (err) {
        res.status(500).json(rpc(msg.id, null, { code: -32603, message: err.message }));
      }
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  const url = req.url || "/";
  setSecurityHeaders(req, res);

  if (req.method === "OPTIONS") {
    const origin = String(req.headers?.origin || "");
    const allowedOrigin = res.getHeader("Access-Control-Allow-Origin");
    res.status(!origin || allowedOrigin ? 204 : 403).end();
    return;
  }

  if (url === "/" || url === "/health") return handleHealth(req, res);

  const auth = authorizeRequest(req);
  if (!auth.ok) return rejectUnauthorized(res, auth);
  req.mcpScope = auth.scope;

  if (url === "/mcp" || url.startsWith("/mcp?") ||
      url === "/mcp-full" || url.startsWith("/mcp-full?")) return handleMcp(req, res);
  if (url === "/mcp-gpt" || url.startsWith("/mcp-gpt?")) return handleMcpGpt(req, res);
  if (url === "/sse" || url.startsWith("/sse?")) return handleSse(req, res);
  if (url?.includes("favicon")) { res.status(404).end(); return; }

  res.status(404).json({ error: "Not found" });
};
