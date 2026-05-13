#!/usr/bin/env node
/**
 * Smoke tests — verifies the promoted ToolRegistry endpoints.
 *
 * Usage (local):
 *   node test-mcp-full.js [port]
 *
 * Usage (production):
 *   BASE=https://go-high-level-mcp-2026-complete-wine.vercel.app node test-mcp-full.js
 */

const BASE = process.env.BASE || `http://localhost:${process.argv[2] || 3001}`;
let passed = 0, failed = 0;

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

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, body: await r.json() };
}

async function post(path, payload) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: r.status, body: await r.json() };
}

(async () => {
  console.log(`\nSmoke tests → ${BASE}\n`);

  // ── /mcp (now backed by ToolRegistry) ──────────────────────────────────────
  console.log("── /mcp (ToolRegistry, promoted) ──");

  await check("/mcp GET returns 200", async () => {
    const { status } = await get("/mcp");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await check("/mcp GET toolCount > 110", async () => {
    const { body } = await get("/mcp");
    assert(body.toolCount > 110, `Expected >110, got ${body.toolCount}`);
    console.log(`      (toolCount: ${body.toolCount})`);
  });

  await check("/mcp POST initialize works", async () => {
    const { body } = await post("/mcp", {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    assert(body.result?.protocolVersion === "2024-11-05", `Bad initialize: ${JSON.stringify(body)}`);
  });

  await check("/mcp POST tools/list > 110 tools", async () => {
    const { body } = await post("/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const count = body.result?.tools?.length;
    assert(count > 110, `Expected >110, got ${count}`);
    console.log(`      (tools/list count: ${count})`);
  });

  await check("/mcp POST ping", async () => {
    const { body } = await post("/mcp", { jsonrpc: "2.0", id: 99, method: "ping" });
    assert(JSON.stringify(body.result) === "{}", `Expected {}, got ${JSON.stringify(body.result)}`);
  });

  // ── /mcp-full alias ─────────────────────────────────────────────────────────
  console.log("\n── /mcp-full (alias, same backend) ──");

  await check("/mcp-full GET toolCount matches /mcp", async () => {
    const [a, b] = await Promise.all([get("/mcp"), get("/mcp-full")]);
    assert(a.body.toolCount === b.body.toolCount,
      `Mismatch: /mcp=${a.body.toolCount}, /mcp-full=${b.body.toolCount}`);
  });

  // ── /mcp-legacy (rollback, must still be 110) ──────────────────────────────
  console.log("\n── /mcp-legacy (rollback, api/index.js, must stay 110) ──");

  await check("/mcp-legacy GET toolCount === 110", async () => {
    const { body } = await get("/mcp-legacy");
    assert(body.toolCount === 110, `Expected 110, got ${body.toolCount}`);
  });

  await check("/mcp-legacy POST tools/list === 110", async () => {
    const { body } = await post("/mcp-legacy", { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const count = body.result?.tools?.length;
    assert(count === 110, `Expected 110, got ${count}`);
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
