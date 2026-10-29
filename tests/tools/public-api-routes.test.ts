import axios, { InternalAxiosRequestConfig } from 'axios';
import { GHLApiClient } from '../../src/clients/ghl-api-client';
import { PhoneTools } from '../../src/tools/phone-tools';
import { PhoneSystemTools } from '../../src/tools/phone-system-tools';
import { FunnelsTools } from '../../src/tools/funnels-tools';
import { WorkflowTools } from '../../src/tools/workflow-tools';

describe('public API routes', () => {
  let client: GHLApiClient;
  let requests: InternalAxiosRequestConfig[];

  beforeEach(() => {
    requests = [];
    const create = axios.create.bind(axios);
    jest.spyOn(axios, 'create').mockImplementation(config => create({
      ...config,
      adapter: async request => {
        requests.push(request);
        return { data: { numbers: [], funnels: [], workflows: [] }, status: 200,
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
});
