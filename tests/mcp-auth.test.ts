const {
  authorizeRequest,
  isReadOnlyTool,
  requestToken,
  safeTokenEqual,
  setSecurityHeaders,
} = require("../api/auth.js");

describe("hosted MCP authentication", () => {
  const originalToken = process.env.MCP_ACCESS_TOKEN;
  const originalRead = process.env.MCP_READ_TOKEN;
  const originalOrigins = process.env.MCP_ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.MCP_ACCESS_TOKEN;
    else process.env.MCP_ACCESS_TOKEN = originalToken;
    if (originalRead === undefined) delete process.env.MCP_READ_TOKEN;
    else process.env.MCP_READ_TOKEN = originalRead;
    if (originalOrigins === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
    else process.env.MCP_ALLOWED_ORIGINS = originalOrigins;
  });

  it("fails closed when no server token is configured", () => {
    delete process.env.MCP_ACCESS_TOKEN;
    delete process.env.MCP_READ_TOKEN;
    expect(authorizeRequest({ headers: {}, url: "/mcp" })).toEqual(
      expect.objectContaining({ ok: false, status: 503 })
    );
  });

  it("accepts bearer, dedicated header, and query-token clients", () => {
    process.env.MCP_ACCESS_TOKEN = "test-access-token";
    const requests = [
      { headers: { authorization: "Bearer test-access-token" }, url: "/mcp" },
      { headers: { "x-mcp-access-token": "test-access-token" }, url: "/mcp" },
      { headers: {}, url: "/mcp?key=test-access-token" },
    ];
    for (const req of requests) expect(authorizeRequest(req)).toEqual({ ok: true, scope: "admin" });
  });

  it("grants read scope to the read token and admin scope to the admin token", () => {
    process.env.MCP_ACCESS_TOKEN = "admin-token";
    process.env.MCP_READ_TOKEN = "read-token";
    expect(authorizeRequest({ headers: { authorization: "Bearer read-token" }, url: "/mcp" }))
      .toEqual({ ok: true, scope: "read" });
    expect(authorizeRequest({ headers: {}, url: "/mcp?key=admin-token" }))
      .toEqual({ ok: true, scope: "admin" });
    expect(authorizeRequest({ headers: {}, url: "/mcp?key=other" }))
      .toEqual(expect.objectContaining({ ok: false, status: 401 }));
  });

  it("classifies read-only tools by name", () => {
    for (const ok of ["get_contact", "search_contacts", "list_invoices", "ghl_get_workflows",
      "crm_pipeline_workspace", "crm_prepare_contact_note", "summarize_calendar_availability"])
      expect(isReadOnlyTool(ok)).toBe(true);
    for (const bad of ["send_sms", "send_email", "delete_contact", "update_contact", "create_opportunity",
      "add_contact_tags", "ghl_publish_workflow", "ghl_trigger_workflow", "bulk_update_contact_tags",
      "purchase_phone_number", "upsert_contact", "enable_trigger", "reply_to_review"])
      expect(isReadOnlyTool(bad)).toBe(false);
  });

  it("rejects an incorrect token", () => {
    process.env.MCP_ACCESS_TOKEN = "test-access-token";
    expect(
      authorizeRequest({ headers: { authorization: "Bearer wrong" }, url: "/mcp" })
    ).toEqual(expect.objectContaining({ ok: false, status: 401 }));
  });

  it("does not use a non-Bearer Authorization value as a token", () => {
    expect(requestToken({ headers: { authorization: "Basic abc" }, url: "/mcp" })).toBe("");
    expect(safeTokenEqual("same", "same")).toBe(true);
    expect(safeTokenEqual("short", "longer")).toBe(false);
  });

  it("only reflects explicitly allowed browser origins", () => {
    process.env.MCP_ALLOWED_ORIGINS = "https://claude.ai, https://chatgpt.com";
    const headers: Record<string, string> = {};
    const res = { setHeader: (key: string, value: string) => { headers[key] = value; } };
    setSecurityHeaders({ headers: { origin: "https://claude.ai" } }, res);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://claude.ai");

    const rejectedHeaders: Record<string, string> = {};
    const rejectedRes = {
      setHeader: (key: string, value: string) => { rejectedHeaders[key] = value; },
    };
    setSecurityHeaders({ headers: { origin: "https://evil.example" } }, rejectedRes);
    expect(rejectedHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
