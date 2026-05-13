#!/usr/bin/env node
/**
 * Minimal local dev server that mimics Vercel routing for testing.
 * Routes /mcp-full* → api/mcp-full.js, everything else → api/index.js
 *
 * Usage: node local-dev-server.js [port]
 */

const http = require("http");
const PORT = parseInt(process.argv[2] || "3001", 10);

// Load handlers (they expect (req, res) like Express/Vercel)
const mcpFullHandler = require("./api/mcp-full.js");
const mcpHandler = require("./api/index.js");

// Minimal response adapter so our handlers can call res.status().json() etc.
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
  return res;
}

const server = http.createServer((req, res) => {
  wrapRes(res);
  const url = req.url || "/";
  if (url.startsWith("/mcp-full")) {
    mcpFullHandler(req, res).catch(err => {
      console.error("mcp-full error:", err);
      res.status(500).json({ error: err.message });
    });
  } else {
    mcpHandler(req, res).catch(err => {
      console.error("index error:", err);
      res.status(500).json({ error: err.message });
    });
  }
});

server.listen(PORT, () => {
  console.log(`Local dev server running on http://localhost:${PORT}`);
  console.log(`  /mcp        → api/index.js   (production, 110 tools)`);
  console.log(`  /mcp-full   → api/mcp-full.js (experimental, ToolRegistry)`);
});
