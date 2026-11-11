import axios, { InternalAxiosRequestConfig } from 'axios';
import { EnhancedGHLClient } from '../src/enhanced-ghl-client';
import { PhoneTools } from '../src/tools/phone-tools';
import { PhoneSystemTools } from '../src/tools/phone-system-tools';

// Regression: EnhancedGHLClient (used by src/main.ts and /execute) overrides
// makeRequest. It used to drop the per-request options, so a call that asked
// for Version v3 went out with the client's default version instead.
describe('EnhancedGHLClient per-request API version', () => {
  let client: EnhancedGHLClient;
  let requests: InternalAxiosRequestConfig[];
  let respond: (request: InternalAxiosRequestConfig) => { status: number; data: any; headers?: any };

  beforeEach(() => {
    requests = [];
    respond = () => ({ status: 200, data: { data: { numbers: [] } } });
    const create = axios.create.bind(axios);
    jest.spyOn(axios, 'create').mockImplementation(config => create({
      ...config,
      adapter: async request => {
        requests.push(request);
        const { status, data, headers = {} } = respond(request);
        const response = { data, status, statusText: String(status), headers, config: request };
        if (status >= 400) {
          throw Object.assign(new Error(`Request failed with status code ${status}`),
            { isAxiosError: true, response, config: request });
        }
        return response;
      },
    }));
    client = new EnhancedGHLClient({ accessToken: 'pit-test', locationId: 'locBound',
      version: '2021-07-28', baseUrl: 'https://services.leadconnectorhq.com' });
  });

  afterEach(() => jest.restoreAllMocks());

  const version = (i: number) => requests[i].headers.get('Version');

  it('forwards the version override on every HTTP method', async () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      await client.makeRequest(method, `/probe/${method}`, method === 'GET' || method === 'DELETE' ? undefined : {}, { version: 'v3' });
    }
    expect(requests.map((_, i) => version(i))).toEqual(['v3', 'v3', 'v3', 'v3', 'v3']);
  });

  it('keeps the default version when no override is given, before and after an override', async () => {
    await client.makeRequest('GET', '/contacts/?a=1');
    await client.makeRequest('GET', '/phone-system/x', undefined, { version: 'v3' });
    await client.makeRequest('GET', '/contacts/?a=2');
    expect([version(0), version(1), version(2)]).toEqual(['2021-07-28', 'v3', '2021-07-28']);
  });

  it('does not serve a default-version cache entry to a v3 request for the same path', async () => {
    respond = request => ({ status: 200, data: { seen: request.headers.get('Version') } });
    const plain: any = await client.makeRequest('GET', '/same/path');
    const v3: any = await client.makeRequest('GET', '/same/path', undefined, { version: 'v3' });
    const v3Again: any = await client.makeRequest('GET', '/same/path', undefined, { version: 'v3' });
    expect(plain.data.seen).toBe('2021-07-28');
    expect(v3.data.seen).toBe('v3');
    expect(v3Again.data.seen).toBe('v3');
    expect(requests).toHaveLength(2); // third call is a cache hit on the v3 entry
  });

  it('keeps the version override when a request is retried after a 429', async () => {
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 as any; }) as any);
    let calls = 0;
    respond = () => (++calls === 1 ? { status: 429, data: { message: 'Too Many Requests' } }
      : { status: 200, data: { ok: true } });
    const result: any = await client.makeRequest('GET', '/phone-system/retry', undefined, { version: 'v3' });
    expect(result.data.ok).toBe(true);
    expect([version(0), version(1)]).toEqual(['v3', 'v3']);
  });

  it.each([
    [PhoneTools, 'get_phone_numbers'],
    [PhoneSystemTools, 'list_active_numbers_by_location'],
    [PhoneSystemTools, 'ghl_list_phone_numbers'],
  ] as const)('%s %s sends Version v3 through the enhanced client', async (Module, name) => {
    await new Module(client as any).handleToolCall(name, {});
    expect(requests[0].url).toBe('/phone-system/numbers/location/locBound?pageSize=50&page=0');
    expect(version(0)).toBe('v3');
    await client.makeRequest('GET', '/contacts/');
    expect(version(1)).toBe('2021-07-28');
  });
});
