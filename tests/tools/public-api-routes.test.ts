import axios, { InternalAxiosRequestConfig } from 'axios';
import { GHLApiClient } from '../../src/clients/ghl-api-client';
import { PhoneTools } from '../../src/tools/phone-tools';
import { PhoneSystemTools } from '../../src/tools/phone-system-tools';
import { FunnelsTools } from '../../src/tools/funnels-tools';
import { WorkflowTools } from '../../src/tools/workflow-tools';
import { UsersTools } from '../../src/tools/users-tools';
import { TemplatesTools } from '../../src/tools/templates-tools';

describe('public API routes', () => {
  let client: GHLApiClient;
  let requests: InternalAxiosRequestConfig[];
  let responseData: Record<string, any>;

  beforeEach(() => {
    requests = [];
    responseData = { numbers: [], funnels: [], workflows: [] };
    const create = axios.create.bind(axios);
    jest.spyOn(axios, 'create').mockImplementation(config => create({
      ...config,
      adapter: async request => {
        requests.push(request);
        return { data: responseData, status: 200,
          statusText: 'OK', headers: {}, config: request };
      },
    }));
    client = new GHLApiClient({ accessToken: 'pit-test', locationId: 'locBound',
      version: '2021-07-28', baseUrl: 'https://services.leadconnectorhq.com' });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['get_phone_numbers', 'list_active_numbers_by_location'])(
    '%s uses the supported route and v3 without changing other CRM requests', async name => {
      const tools = name === 'get_phone_numbers' ? new PhoneTools(client) : new PhoneSystemTools(client);
      await tools.handleToolCall(name, {});
      await client.makeRequest('GET', '/contacts/');
      expect(requests[0].url).toBe('/phone-system/numbers/location/locBound');
      expect(requests[0].headers.get('Version')).toBe('v3');
      expect(requests[0].headers.get('Authorization')).toBe('Bearer pit-test');
      expect(requests[1].headers.get('Version')).toBe('2021-07-28');
    }
  );

  it('uses the requested location and encodes path segments for phone listing', async () => {
    await new PhoneTools(client).handleToolCall('get_phone_numbers', { locationId: 'loc/Other' });
    expect(requests[0].url).toBe('/phone-system/numbers/location/loc%2FOther');
  });

  it('lists funnels using the documented route, offset, and filters', async () => {
    await new FunnelsTools(client).handleToolCall('get_funnels', {
      locationId: 'locOther', skip: 10, limit: 5, type: 'website',
      name: 'Land & Home', category: 'test', parentId: 'folder',
    });
    const url = new URL(requests[0].url!, 'https://example.com');
    expect(url.pathname).toBe('/funnels/funnel/list');
    expect(Object.fromEntries(url.searchParams)).toEqual({ locationId: 'locOther',
      offset: '10', limit: '5', type: 'website', name: 'Land & Home',
      category: 'test', parentId: 'folder' });
  });

  it('keeps the bound location and explicit zero offset when listing funnels', async () => {
    await new FunnelsTools(client).handleToolCall('get_funnels', { skip: 0 });
    expect(requests[0].url).toBe('/funnels/funnel/list?locationId=locBound&offset=0');
  });

  it('explains the workflow detail limitation without issuing an unsupported request', async () => {
    await expect(new WorkflowTools(client).executeWorkflowTool('ghl_get_workflow', {
      workflowId: 'wf1',
    })).rejects.toThrow(/not available through the GoHighLevel public API/);
    expect(requests).toHaveLength(0);
  });

  it('continues to list workflows through the public API', async () => {
    await new WorkflowTools(client).executeWorkflowTool('ghl_list_workflows', {});
    expect(requests[0].url).toBe('/workflows/?locationId=locBound');
  });

  it('sends only locationId for users and applies role, type, IDs, sorting and pagination locally', async () => {
    responseData = { users: [
      { id: 'u1', name: 'Zoe', roles: { type: 'account', role: 'admin' } },
      { id: 'u2', name: 'Amy', roles: { type: 'account', role: 'admin' } },
      { id: 'u3', name: 'Bob', roles: { type: 'account', role: 'user' } },
      { id: 'u4', name: 'Dan', roles: { type: 'agency', role: 'admin' } },
      { id: 'u5', name: 'Kim', roles: { type: 'account', role: 'admin' } },
    ], traceId: 'trace' };
    const out: any = await new UsersTools(client).handleToolCall('get_users', {
      locationId: 'locOther', ids: 'u1, u2,u3,u4', role: 'admin', type: 'account',
      sort: 'name', sortDirection: 'asc', skip: 1, limit: 1,
    });
    expect(requests[0].url).toBe('/users/?locationId=locOther');
    expect(out.data.users.map((u: any) => u.id)).toEqual(['u1']);
    expect(out.data).toMatchObject({ total: 2, returned: 1, traceId: 'trace' });
  });

  it('preserves all location users when filters are omitted', async () => {
    responseData = { users: [{ id: 'u1' }, { id: 'u2' }] };
    const out: any = await new UsersTools(client).handleToolCall('get_users', {});
    expect(requests[0].url).toBe('/users/?locationId=locBound');
    expect(out.data.users).toEqual(responseData.users);
  });

  it.each(['all', 'sms', 'email'])('loads %s snippets through location templates', async type => {
    responseData = { templates: [{ id: 't1', type: 'sms' }], totalCount: 3 };
    const out: any = await new TemplatesTools(client).handleToolCall('get_snippets', {
      locationId: 'locOther', type, skip: 1, limit: 2,
    });
    expect(requests[0].url).toBe('/locations/locOther/templates');
    expect(requests[0].params).toEqual({
      originId: '', deleted: false, skip: 1, limit: 2,
      ...(type === 'all' ? {} : { type }),
    });
    expect(out.data).toMatchObject({ snippets: responseData.templates, totalCount: 3 });
  });
});
