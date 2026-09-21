/**
 * Regression: the workflow-builder tools used to build their client from process.env, so in a
 * multi-location deployment every call — including create / update / publish / clone / delete —
 * went to the DEFAULT sub-account regardless of the `locationId` that was asked for.
 */
import { WorkflowBuilderTools } from '../src/tools/workflow-builder-tools';
import { WorkflowTools } from '../src/tools/workflow-tools';

const DEFAULT_LOC = 'locDefault';
const DEFAULT_KEY = 'pit-default-key';
const OTHER_LOC = 'locOther';
const OTHER_KEY = 'pit-other-key';

type Sent = { url: string; method: string; auth: string; body: any };

function mockFetch(sent: Sent[]) {
  return jest.fn(async (url: any, init: any = {}) => {
    sent.push({
      url: String(url),
      method: init.method || 'GET',
      auth: String(init.headers?.Authorization || ''),
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const payload = {
      _id: 'wf1', id: 'wf1', name: 'wf', status: 'draft', version: 1,
      workflowData: { templates: [] }, triggers: [], workflows: [], rows: [], total: 0, count: 0,
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as any;
  });
}

const CALLS: [string, Record<string, unknown>][] = [
  ['ghl_list_workflows_full', {}],
  ['ghl_get_workflow_full', { workflowId: 'wf1' }],
  ['ghl_create_workflow', { name: 'new wf' }],
  ['ghl_update_workflow_actions', { workflowId: 'wf1', name: 'renamed' }],
  ['ghl_publish_workflow', { workflowId: 'wf1' }],
  ['ghl_clone_workflow', { workflowId: 'wf1' }],
  ['ghl_delete_workflow', { workflowId: 'wf1' }],
];

describe('workflow-builder tools are bound to their sub-account', () => {
  const savedEnv = { ...process.env };
  const savedFetch = (global as any).fetch;
  let sent: Sent[];

  beforeEach(() => {
    // The deployment's env still describes the DEFAULT sub-account (legacy pair).
    process.env = { ...savedEnv, GHL_API_KEY: DEFAULT_KEY, GHL_LOCATION_ID: DEFAULT_LOC, HOME: '/nonexistent-home' };
    for (const k of ['GHL_REFRESH_TOKEN', 'GHL_AUTH_REFRESH_TOKEN', 'GHL_FIREBASE_API_KEY', 'GHL_FIREBASE_REFRESH_TOKEN'])
      delete process.env[k];
    sent = [];
    (global as any).fetch = mockFetch(sent);
  });
  afterEach(() => { process.env = { ...savedEnv }; (global as any).fetch = savedFetch; });

  const boundTo = (locationId: string, accessToken: string) =>
    new WorkflowBuilderTools({ getConfig: () => ({ locationId, accessToken }) });

  it.each(CALLS)('%s uses the bound sub-account id and key, never the env default', async (tool, args) => {
    const result = await boundTo(OTHER_LOC, OTHER_KEY).executeWorkflowBuilderTool(tool, { ...args, locationId: OTHER_LOC });
    expect(result.isError).toBeFalsy();
    expect(sent.length).toBeGreaterThan(0);
    for (const req of sent) {
      expect(req.auth).toBe(`Bearer ${OTHER_KEY}`);
      expect(req.url + JSON.stringify(req.body || {})).toContain(OTHER_LOC);
      expect(req.url + JSON.stringify(req.body || {})).not.toContain(DEFAULT_LOC);
      expect(req.auth).not.toContain(DEFAULT_KEY);
    }
  });

  it.each(CALLS)('%s without a locationId argument still acts in the bound sub-account', async (tool, args) => {
    await boundTo(OTHER_LOC, OTHER_KEY).executeWorkflowBuilderTool(tool, args);
    expect(sent.length).toBeGreaterThan(0);
    for (const req of sent) {
      expect(req.auth).toBe(`Bearer ${OTHER_KEY}`);
      expect(req.url + JSON.stringify(req.body || {})).not.toContain(DEFAULT_LOC);
    }
  });

  it.each(CALLS)('%s refuses a locationId it is not bound to and sends nothing', async (tool, args) => {
    const result = await boundTo(DEFAULT_LOC, DEFAULT_KEY).executeWorkflowBuilderTool(tool, { ...args, locationId: OTHER_LOC });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Refusing/);
    expect(sent).toHaveLength(0);
  });

  it('picks up a rotated key without a restart', async () => {
    let token = OTHER_KEY;
    const tools = new WorkflowBuilderTools({ getConfig: () => ({ locationId: OTHER_LOC, accessToken: token }) });
    await tools.executeWorkflowBuilderTool('ghl_list_workflows_full', {});
    token = 'pit-rotated';
    await tools.executeWorkflowBuilderTool('ghl_list_workflows_full', {});
    expect(sent.map(r => r.auth)).toEqual([`Bearer ${OTHER_KEY}`, 'Bearer pit-rotated']);
  });

  it('has no built-in fallback sub-account when nothing is configured', async () => {
    delete process.env.GHL_LOCATION_ID;
    const result = await new WorkflowBuilderTools({ getConfig: () => ({ accessToken: OTHER_KEY }) })
      .executeWorkflowBuilderTool('ghl_list_workflows_full', {});
    expect(result.isError).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

describe('ghl_list_workflows (public API)', () => {
  it('sends only locationId and applies status / skip / limit locally', async () => {
    const paths: string[] = [];
    const workflows = [
      { id: 'a', status: 'draft' }, { id: 'b', status: 'published' },
      { id: 'c', status: 'draft' }, { id: 'd', status: 'draft' },
    ];
    const apiClient: any = {
      getConfig: () => ({ locationId: OTHER_LOC }),
      makeRequest: async (_m: string, path: string) => { paths.push(path); return { success: true, data: { workflows } }; },
    };
    const tools = new WorkflowTools(apiClient);
    const out = await tools.executeWorkflowTool('ghl_list_workflows', { status: 'draft', limit: 2, skip: 1 });
    expect(paths).toEqual([`/workflows/?locationId=${OTHER_LOC}`]);
    expect(out.data.workflows.map((w: any) => w.id)).toEqual(['c', 'd']);
    expect(out.data.total).toBe(3);
  });
});
