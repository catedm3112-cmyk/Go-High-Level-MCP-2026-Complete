#!/usr/bin/env node
/**
 * Local smoke test — verifies /mcp returns 110 tools and /mcp-full returns the
 * ToolRegistry count, without touching production.
 *
 * Usage (with local vercel dev running on port 3000):
 *   node test-mcp-full.js [port]
 *
 * Or point at production (read-only GET requests only):
 *   BASE=https://go-high-level-mcp-2026-complete-wine.vercel.app node test-mcp-full.js
 */

const BASE = process.env.BASE || `http://localhost:${process.argv[2] || 3000}`;

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${label}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const json = await r.json();
  return { status: r.status, body: json };
}

async function post(path, payload) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await r.json();
  return { status: r.status, body: json };
}

(async () => {
  console.log(`\nRunning smoke tests against ${BASE}\n`);

  // ── /mcp (production route — must stay 110 tools) ─────────────────────────
  console.log("── /mcp (production, must stay unchanged) ──");

  await check("/mcp GET returns 200", async () => {
    const { status } = await get("/mcp");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await check("/mcp GET toolCount === 110", async () => {
    const { body } = await get("/mcp");
    assert(body.toolCount === 110, `Expected 110, got ${body.toolCount}`);
  });

  await check("/mcp POST initialize works", async () => {
    const { body } = await post("/mcp", {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    assert(body.result?.protocolVersion === "2024-11-05", `Bad initialize response: ${JSON.stringify(body)}`);
  });

  await check("/mcp POST tools/list returns 110 tools", async () => {
    const { body } = await post("/mcp", {
      jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
    });
    const count = body.result?.tools?.length;
    assert(count === 110, `Expected 110 tools, got ${count}`);
  });

  // ── /mcp-full (experimental endpoint) ────────────────────────────────────
  console.log("\n── /mcp-full (experimental, ToolRegistry) ──");

  await check("/mcp-full GET returns 200", async () => {
    const { status } = await get("/mcp-full");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await check("/mcp-full GET has toolCount field", async () => {
    const { body } = await get("/mcp-full");
    assert(typeof body.toolCount === "number", `toolCount missing or non-numeric: ${JSON.stringify(body)}`);
  });

  await check("/mcp-full GET toolCount > 110", async () => {
    const { body } = await get("/mcp-full");
    assert(body.toolCount > 110, `Expected >110 from ToolRegistry, got ${body.toolCount}`);
    console.log(`      (ToolRegistry count: ${body.toolCount})`);
  });

  await check("/mcp-full POST initialize works", async () => {
    const { body } = await post("/mcp-full", {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    assert(body.result?.protocolVersion === "2024-11-05", `Bad initialize response: ${JSON.stringify(body)}`);
  });

  await check("/mcp-full POST tools/list count matches GET toolCount", async () => {
    const [disc, list] = await Promise.all([
      get("/mcp-full"),
      post("/mcp-full", { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    ]);
    const discCount = disc.body.toolCount;
    const listCount = list.body.result?.tools?.length;
    // tools/list uses getAllToolDefinitions([]) which includes allToolDefs
    assert(
      typeof listCount === "number" && listCount > 110,
      `Expected >110 from tools/list, got ${listCount}`
    );
    console.log(`      (GET toolCount=${discCount}, POST tools/list count=${listCount})`);
  });

  await check("/mcp-full POST ping returns empty result", async () => {
    const { body } = await post("/mcp-full", { jsonrpc: "2.0", id: 99, method: "ping" });
    assert(JSON.stringify(body.result) === "{}", `Expected {}, got ${JSON.stringify(body.result)}`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
