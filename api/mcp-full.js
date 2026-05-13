// /mcp-full — Experimental MCP endpoint backed by TypeScript ToolRegistry
// Keeps /mcp and /sse completely untouched.
//
// GET  /mcp-full  → discovery (name, toolCount, protocol)
// POST /mcp-full  → JSON-RPC 2.0 (initialize | tools/list | tools/call | ping)

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "ghl-mcp-full", version: "2.1.0" };

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
      // dist/ is compiled by `tsc` during vercel-build
      const { GHLApiClient } = require("../dist/clients/ghl-api-client.js");
      const { ToolRegistry } = require("../dist/tool-registry.js");

      const apiKey    = process.env.GHL_API_KEY;
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
      _initPromise = null;       // allow retry after fix
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
      if (!name) {
        return rpc(msg.id, null, { code: -32602, message: "Missing tool name" });
      }
      try {
        const result = await registry.callTool(name, args || {});
        if (result === undefined) {
          return rpc(msg.id, null, { code: -32601, message: `Tool not found: ${name}` });
        }
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

// ─── CORS helpers ─────────────────────────────────────────────────────────────

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  setCORS(res);

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  // GET → discovery
  if (req.method === "GET") {
    try {
      const registry = await getRegistry();
      res.status(200).json({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: MCP_PROTOCOL_VERSION,
        endpoint: "POST /mcp-full",
        toolCount: registry.getToolCount(),
        note: "Experimental endpoint backed by TypeScript ToolRegistry",
      });
    } catch (err) {
      res.status(500).json({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        error: `Registry init failed: ${err.message}`,
        note: "Ensure GHL_API_KEY and GHL_LOCATION_ID are set and dist/ is compiled",
      });
    }
    return;
  }

  // POST → JSON-RPC
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.status(400).json(rpc(null, null, { code: -32700, message: "Parse error" }));
        return;
      }

      let registry;
      try {
        registry = await getRegistry();
      } catch (err) {
        res.status(200).json(rpc(msg.id, null, {
          code: -32603,
          message: `Registry unavailable: ${err.message}`,
        }));
        return;
      }

      try {
        const response = await processMessage(msg, registry);
        res.status(200).setHeader("Content-Type", "application/json").end(JSON.stringify(response));
      } catch (err) {
        res.status(500).json(rpc(msg.id, null, { code: -32603, message: err.message }));
      }
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
