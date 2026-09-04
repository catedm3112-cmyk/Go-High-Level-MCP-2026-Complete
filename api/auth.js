const { timingSafeEqual } = require("crypto");

function safeTokenEqual(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

function requestToken(req) {
  const authorization = String(req.headers?.authorization || "");
  const bearer = authorization.replace(/^Bearer\s+/i, "");
  if (bearer && bearer !== authorization) return bearer;

  const headerToken = req.headers?.["x-mcp-access-token"];
  if (headerToken) return String(headerToken);

  try {
    return new URL(req.url || "/", "http://localhost").searchParams.get("key") || "";
  } catch {
    return "";
  }
}

// Tool names a read-scoped token may list and call. Everything else (create,
// update, delete, send, add/remove, publish, trigger, enable/disable, purchase,
// upload, bulk_*, ...) requires the admin token.
const READ_ONLY_TOOL = new RegExp(
  "^(" +
    [
      "get_", "list_", "search_", "filter_", "summarize_", "count_", "check_",
      "ghl_get_", "ghl_list_", "crm_list_", "crm_find_", "crm_prepare_",
      "crm_location_health_check$", "crm_[a-z_]+_workspace$",
      "audit_location_ads_setup$", "download_transcription$", "validate_group_slug$",
      "generate_estimate_number$", "generate_invoice_number$",
    ].join("|") +
  ")"
);

function isReadOnlyTool(name) {
  return READ_ONLY_TOOL.test(String(name || ""));
}

function authorizeRequest(req) {
  const admin = process.env.MCP_ACCESS_TOKEN || "";
  const read = process.env.MCP_READ_TOKEN || "";
  if (!admin && !read) {
    return {
      ok: false,
      status: 503,
      message: "MCP access is not configured",
    };
  }

  const presented = requestToken(req);
  if (admin && safeTokenEqual(presented, admin)) return { ok: true, scope: "admin" };
  // MCP_READ_TOKEN_SCOPE=admin promotes the read token to full scope (owner decision
  // 2026-09-04: every Claude surface needs write access). Unset or "read" keeps the split.
  const readScope = process.env.MCP_READ_TOKEN_SCOPE === "admin" ? "admin" : "read";
  if (read && safeTokenEqual(presented, read)) return { ok: true, scope: readScope };

  return {
    ok: false,
    status: 401,
    message: "Unauthorized",
  };
}

function setSecurityHeaders(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, X-MCP-Access-Token"
  );
  res.setHeader("Access-Control-Max-Age", "600");

  const origin = String(req.headers?.origin || "");
  const allowed = String(process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
}

function rejectUnauthorized(res, auth) {
  res.status(auth.status).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: auth.message },
    id: null,
  });
}

module.exports = {
  authorizeRequest,
  isReadOnlyTool,
  rejectUnauthorized,
  requestToken,
  safeTokenEqual,
  setSecurityHeaders,
};
