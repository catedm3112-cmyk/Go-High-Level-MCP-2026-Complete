import { WorkflowTools } from '../../src/tools/workflow-tools';
import { PhoneTools } from '../../src/tools/phone-tools';
import { PhoneSystemTools } from '../../src/tools/phone-system-tools';
import { FunnelsTools } from '../../src/tools/funnels-tools';

function client() {
  return {
    getConfig: () => ({ locationId: 'boundLocation' }),
    makeRequest: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getActivePhoneNumbers: jest.fn().mockResolvedValue({ success: true, data: {} }),
    addContactToWorkflow: jest.fn().mockResolvedValue({ success: true, data: { succeeded: true } }),
  };
}

describe('public workflow capabilities', () => {
  it.each(['ghl_get_workflow', 'ghl_update_workflow_status', 'ghl_delete_workflow', 'ghl_get_workflow_executions'])(
    '%s explains the API limitation without calling a nonexistent route', async name => {
      const api = client();
      await expect(new WorkflowTools(api as any).executeWorkflowTool(name, { workflowId: 'workflow' }))
        .rejects.toThrow(/public API.*Private Integration keys/);
      expect(api.makeRequest).not.toHaveBeenCalled();
    });

  it('enrolls a contact using the supported contact workflow operation', async () => {
    const api = client();
    await new WorkflowTools(api as any).executeWorkflowTool('ghl_trigger_workflow', {
      contactId: 'contact', workflowId: 'workflow',
    });
    expect(api.addContactToWorkflow).toHaveBeenCalledWith('contact', 'workflow');
    expect(api.makeRequest).not.toHaveBeenCalled();
  });
});

describe('phone inventory aliases', () => {
  it.each([
    [PhoneTools, 'get_phone_numbers'],
    [PhoneSystemTools, 'list_active_numbers_by_location'],
    [PhoneSystemTools, 'ghl_list_phone_numbers'],
  ] as const)('%s %s uses the location-bound v3 phone client', async (Module, name) => {
    const api = client();
    await new Module(api as any).handleToolCall(name, {});
    expect(api.getActivePhoneNumbers.mock.calls[0][0]).toBe('boundLocation');
    expect(api.makeRequest).not.toHaveBeenCalled();
  });

  it('passes pagination to the phone client', async () => {
    const api = client();
    await new PhoneSystemTools(api as any).handleToolCall('ghl_list_phone_numbers', { limit: 3, skip: 4 });
    expect(api.getActivePhoneNumbers).toHaveBeenCalledWith('boundLocation', 3, 4);
  });
});

describe('public funnel and website routes', () => {
  it('uses the public inventory route and translates skip to offset', async () => {
    const api = client();
    await new FunnelsTools(api as any).handleToolCall('get_funnels', { type: 'website', limit: 2, skip: 4 });
    expect(api.makeRequest).toHaveBeenCalledWith('GET',
      '/funnels/funnel/list?locationId=boundLocation&offset=4&limit=2&type=website');
  });

  it('sends required pagination and funnel ID for page records', async () => {
    const api = client();
    await new FunnelsTools(api as any).handleToolCall('get_funnel_pages', { funnelId: 'funnel' });
    expect(api.makeRequest).toHaveBeenCalledWith('GET',
      '/funnels/page?locationId=boundLocation&funnelId=funnel&offset=0&limit=10');
  });

  it('finds a specific funnel beyond the first inventory page', async () => {
    const api = client();
    const found = { _id: 'target', name: 'Website' };
    api.makeRequest.mockResolvedValueOnce({ success: true, data: { funnels: Array.from({ length: 100 }, (_, i) => ({ _id: `other${i}` })), count: 101 } })
      .mockResolvedValueOnce({ success: true, data: { funnels: [found], count: 101 } });
    const result: any = await new FunnelsTools(api as any).handleToolCall('get_funnel', { funnelId: 'target' });
    expect(result.data.funnel).toEqual(found);
    expect(api.makeRequest.mock.calls[1][1]).toContain('offset=100');
  });

  it('reports a missing funnel instead of fabricating details', async () => {
    const api = client();
    api.makeRequest.mockResolvedValue({ success: true, data: { funnels: [], count: 0 } });
    await expect(new FunnelsTools(api as any).handleToolCall('get_funnel', { funnelId: 'missing' }))
      .rejects.toThrow(/not found in the requested location/);
  });
});
