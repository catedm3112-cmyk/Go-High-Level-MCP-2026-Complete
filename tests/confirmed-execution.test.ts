const {
  executeConfirmedWorkflow,
  isConfirmedExecutionRequest,
} = require('../api/confirmed-execution.js');

describe('confirmed workspace execution', () => {
  it('only recognizes explicitly confirmed prepare-tool calls', () => {
    expect(isConfirmedExecutionRequest('crm_prepare_contact_note', { executeConfirmed: true })).toBe(true);
    expect(isConfirmedExecutionRequest('crm_prepare_contact_note', { executeConfirmed: false })).toBe(false);
    expect(isConfirmedExecutionRequest('create_contact_note', { executeConfirmed: true })).toBe(false);
  });

  it('executes the trusted confirmation queue in order', async () => {
    const callTool = jest.fn()
      .mockResolvedValueOnce({ id: 'note-1' })
      .mockResolvedValueOnce({ id: 'task-1' });
    const prepared = {
      summary: 'Two writes staged.',
      confirmationRequired: true,
      executeToolCalls: [
        { tool: 'create_contact_note', arguments: { contactId: 'c1', body: 'Note' } },
        { tool: 'create_contact_task', arguments: { contactId: 'c1', title: 'Follow up' } },
      ],
      nextSteps: ['Confirm first.'],
    };

    const result = await executeConfirmedWorkflow({ callTool }, prepared);

    expect(callTool.mock.calls).toEqual([
      ['create_contact_note', { contactId: 'c1', body: 'Note' }],
      ['create_contact_task', { contactId: 'c1', title: 'Follow up' }],
    ]);
    expect(result).toEqual(expect.objectContaining({
      executed: true,
      confirmationRequired: false,
      executionResults: [
        { tool: 'create_contact_note', result: { id: 'note-1' } },
        { tool: 'create_contact_task', result: { id: 'task-1' } },
      ],
    }));
  });

  it('rejects missing or malformed confirmation queues', async () => {
    await expect(executeConfirmedWorkflow({ callTool: jest.fn() }, {}))
      .rejects.toThrow('did not return an executable confirmation queue');
    await expect(executeConfirmedWorkflow({ callTool: jest.fn() }, {
      executeToolCalls: [{ arguments: {} }],
    })).rejects.toThrow('invalid tool call');
  });
});
