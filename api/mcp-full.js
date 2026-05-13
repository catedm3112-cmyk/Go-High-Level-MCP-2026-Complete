// GHL MCP Server v2.1 — 552 tools via TypeScript ToolRegistry
// Handles: /mcp (Streamable HTTP), /sse (SSE transport), /mcp-full (alias)
//
// /mcp-legacy and /sse-legacy still route to api/index.js for rollback.

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "ghl-mcp-server", version: "2.1.0" };

// ─── GPT-compatible tool allowlist ────────────────────────────────────────────
// ChatGPT enforces a hard cap of ~128 tools per MCP server. This curated set
// (114 tools) covers the most commonly used GHL workflows and stays under that
// limit. The /mcp-gpt endpoint serves only these tools; /mcp is unchanged and
// still serves all 552 tools for Claude and other uncapped clients.

const GPT_TOOL_ALLOWLIST = new Set([
  // Contacts
  "search_contacts", "get_contact", "create_contact", "update_contact", "delete_contact",
  "upsert_contact", "add_contact_tags", "remove_contact_tags",
  "get_contact_notes", "create_contact_note", "update_contact_note",
  "get_contact_tasks", "create_contact_task", "update_contact_task",
  "get_contact_appointments",
  "add_contact_to_workflow", "remove_contact_from_workflow",
  "add_contact_to_campaign", "remove_contact_from_all_campaigns",
  // Conversations / Messaging
  "search_conversations", "get_conversation", "create_conversation",
  "get_messages", "send_sms", "send_email", "update_conversation", "get_recent_messages",
  // Opportunities / Pipeline
  "search_opportunities", "get_opportunity", "create_opportunity", "update_opportunity",
  "delete_opportunity", "get_pipelines", "update_opportunity_status", "upsert_opportunity",
  // Calendars / Appointments
  "get_calendars", "get_calendar", "create_calendar", "update_calendar", "delete_calendar",
  "get_calendar_events", "get_free_slots",
  "create_appointment", "get_appointment", "update_appointment", "delete_appointment",
  "get_calendar_groups",
  // Invoices / Payments
  "list_invoices", "get_invoice", "create_invoice", "send_invoice",
  "list_orders", "get_order_by_id",
  "list_transactions", "get_transaction_by_id", "list_subscriptions",
  // Products / Store
  "ghl_list_products", "ghl_get_product", "ghl_create_product", "ghl_update_product", "ghl_delete_product",
  "ghl_list_prices", "ghl_create_price",
  "list_coupons", "create_coupon", "update_coupon",
  // Workflows
  "ghl_get_workflows", "ghl_get_workflow", "ghl_trigger_workflow", "ghl_list_workflows",
  // Campaigns
  "get_campaigns", "get_campaign", "start_campaign", "pause_campaign", "resume_campaign",
  // Location / Users
  "get_location", "update_location",
  "get_location_custom_fields", "get_location_tags", "create_location_tag",
  "get_location_custom_values",
  "get_users", "get_user", "search_users", "create_user",
  // Blogs
  "get_blog_sites", "get_blog_posts", "create_blog_post", "update_blog_post",
  // Social Media
  "get_social_accounts", "create_social_post", "update_social_post",
  "get_social_post", "get_social_media_statistics",
  // Companies / Businesses
  "get_companies", "get_company", "create_company", "update_company",
  // Email / Templates
  "get_email_templates", "create_email_template", "get_email_campaigns", "get_sms_templates",
  // Forms / Surveys
  "get_forms", "get_form_submissions", "ghl_get_surveys",
  // Reporting
  "get_pipeline_reports", "get_dashboard_stats", "get_email_reports", "get_funnel_reports",
  // Misc high-value
  "get_media_files", "get_webhooks", "create_webhook", "get_snapshots", "get_location_templates",
]);

// ─── Registry (lazy singleton) ────────────────────────────────────────────────

let _registry = null;
let _registryError = null;
let _initPromise = null;

function getRegistry() {
  if (_registry) return Promise.resolve(_registry);
  if (_registryError) return Promise.reject(new Error(_registryError));
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { GHLApiClient } = require("../dist/clients/ghl-api-client.js");
      const { ToolRegistry } = require("../dist/tool-registry.js");

      const apiKey     = process.env.GHL_API_KEY;
      const locationId = process.env.GHL_LOCATION_ID;

      if (!apiKey)     throw new Error("GHL_API_KEY env var not set");
      if (!locationId) throw new Error("GHL_LOCATION_ID env var not set");

      const ghlClient = new GHLApiClient({
        accessToken: apiKey,
        baseUrl:     "https://services.leadconnectorhq.com",
        version:     "2021-07-28",
        locationId,
      });

      _registry = new ToolRegistry(ghlClient);
      return _registry;
    } catch (err) {
      _registryError = err.message;
      _initPromise = null;
      throw err;
    }
  })();

  return _initPromise;
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function rpc(id, result, error) {
  const base = { jsonrpc: "2.0", id: id ?? null };
  return error ? { ...base, error } : { ...base, result };
}

// ─── MCP message processor ────────────────────────────────────────────────────

async function processMessage(msg, registry) {
  switch (msg.method) {
    case "initialize":
      return rpc(msg.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "tools/list": {
      const defs = registry.getAllToolDefinitions([]);
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
      try {
        const result = await registry.callTool(name, args || {});
        if (result === undefined)
          return rpc(msg.id, null, { code: -32601, message: `Tool not found: ${name}` });
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

// ─── CORS & SSE helpers ───────────────────────────────────────────────────────

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

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
  try {
    const registry = await getRegistry();
    res.status(200).json({
      status: "healthy",
      server: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocol: MCP_PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
      toolCount: registry.getToolCount(),
      endpoints: {
        mcp:  "/mcp (POST, Streamable HTTP)",
        sse:  "/sse (SSE)",
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
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

      let registry;
      try { registry = await getRegistry(); }
      catch (err) {
        res.status(200).json(rpc(msg.id, null, { code: -32603, message: `Registry unavailable: ${err.message}` }));
        return;
      }

      try {
        const response = await processMessage(msg, registry);
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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

      let registry;
      try { registry = await getRegistry(); }
      catch (err) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        sendSSE(res, rpc(msg.id, null, { code: -32603, message: `Registry unavailable: ${err.message}` }));
        res.end();
        return;
      }

      try {
        const response = await processMessage(msg, registry);
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

// /mcp-gpt — ChatGPT-compatible endpoint (curated tool subset, ≤128 tools)
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
        note: "ChatGPT-compatible endpoint — curated subset of high-value tools",
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

      let registry;
      try { registry = await getRegistry(); }
      catch (err) {
        res.status(200).json(rpc(msg.id, null, { code: -32603, message: `Registry unavailable: ${err.message}` }));
        return;
      }

      try {
        let response;
        if (msg.method === "tools/list") {
          const allDefs = registry.getAllToolDefinitions([]);
          const filtered = allDefs.filter(t => GPT_TOOL_ALLOWLIST.has(t.name));
          response = rpc(msg.id, {
            tools: filtered.map(t => ({
              name: t.name,
              description: t.description || "",
              inputSchema: t.inputSchema || { type: "object", properties: {} },
            })),
          });
        } else {
          // initialize, tools/call, ping — delegate to the shared processor unchanged
          response = await processMessage(msg, registry);
        }
        res.status(200).setHeader("Content-Type", "application/json").end(JSON.stringify(response));
      } catch (err) {
        res.status(500).json(rpc(msg.id, null, { code: -32603, message: err.message }));
      }
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const url = req.url || "/";

  if (url === "/" || url === "/health") return handleHealth(req, res);
  if (url === "/mcp" || url.startsWith("/mcp?") ||
      url === "/mcp-full" || url.startsWith("/mcp-full?")) return handleMcp(req, res);
  if (url === "/mcp-gpt" || url.startsWith("/mcp-gpt?")) return handleMcpGpt(req, res);
  if (url === "/sse" || url.startsWith("/sse?")) return handleSse(req, res);
  if (url?.includes("favicon")) { res.status(404).end(); return; }

  res.status(404).json({ error: "Not found" });
};
