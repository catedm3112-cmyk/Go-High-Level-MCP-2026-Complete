#!/usr/bin/env node
/**
 * Minimal local dev server that mimics Vercel routing for testing.
 * Matches vercel.json: /mcp-legacy* + /sse-legacy* → api/index.js
 *                      everything else → api/mcp-full.js
 *
 * Usage: node local-dev-server.js [port]
 */

const http = require("http");
const PORT = parseInt(process.argv[2] || "3001", 10);

const mcpFullHandler = require("./api/mcp-full.js");
const mcpLegacyHandler = require("./api/index.js");

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
  if (url.startsWith("/mcp-legacy") || url.startsWith("/sse-legacy")) {
    // Rewrite URL so api/index.js routing matches (it checks req.url === "/mcp" etc.)
    req.url = url.replace("/mcp-legacy", "/mcp").replace("/sse-legacy", "/sse");
    mcpLegacyHandler(req, res).catch(err => {
      console.error("legacy error:", err);
      res.status(500).json({ error: err.message });
    });
  } else {
    mcpFullHandler(req, res).catch(err => {
      console.error("mcp-full error:", err);
      res.status(500).json({ error: err.message });
    });
  }
});

server.listen(PORT, () => {
  console.log(`Local dev server on http://localhost:${PORT}`);
  console.log(`  /mcp, /sse, /mcp-full → api/mcp-full.js  (552 tools)`);
  console.log(`  /mcp-legacy, /sse-legacy → api/index.js  (110 tools, rollback)`);
});
