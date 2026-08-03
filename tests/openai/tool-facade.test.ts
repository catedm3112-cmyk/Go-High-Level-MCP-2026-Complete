import {
  OpenAIGHLFacade,
  ToolCaller,
} from '../../src/openai/tool-facade.js';

class FakeToolCaller implements ToolCaller {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  constructor(
    private readonly responses: Record<string, unknown | ((args: Record<string, unknown>) => unknown)>
  ) {}

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ name, args });
    const response = this.responses[name];
    return typeof response === 'function' ? response(args) : response;
  }
}

function createFacade(tools: ToolCaller) {
  return new OpenAIGHLFacade(tools, {
    locationId: 'loc-123',
    publicBaseUrl: 'https://mcp.example.test',
    now: () => Date.parse('2026-07-24T12:00:00.000Z'),
  });
}

describe('OpenAIGHLFacade', () => {
  test('routes workflow searches without calling communication tools', async () => {
    const tools = new FakeToolCaller({
      ghl_list_workflows: {
        workflows: [
          { id: 'wf-1', name: 'New lead follow-up', status: 'draft' },
          { id: 'wf-2', name: 'Appointment reminder', status: 'active' },
        ],
      },
    });

    const result = await createFacade(tools).search('workflow');

    expect(result.results).toEqual([
      {
        id: 'workflow:wf-1',
        title: 'New lead follow-up',
        url: 'https://mcp.example.test/openai/resources/workflow/wf-1',
      },
      {
        id: 'workflow:wf-2',
        title: 'Appointment reminder',
        url: 'https://mcp.example.test/openai/resources/workflow/wf-2',
      },
    ]);
    expect(tools.calls.map(call => call.name)).toEqual(['ghl_list_workflows']);
  });

  test('returns the standard fetch shape and strips secret-like fields', async () => {
    const tools = new FakeToolCaller({
      get_contact: {
        contact: {
          id: 'contact-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
          accessToken: 'do-not-return',
        },
      },
    });

    const result = await createFacade(tools).fetch('contact:contact-1');

    expect(result.id).toBe('contact:contact-1');
    expect(result.title).toBe('Ada Lovelace');
    expect(result.url).toBe(
      'https://mcp.example.test/openai/resources/contact/contact-1'
    );
    expect(JSON.parse(result.text)).toEqual({
      contact: {
        id: 'contact-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.test',
      },
    });
  });

  test('creates workflows as drafts even when actions are supplied', async () => {
    const tools = new FakeToolCaller({
      ghl_create_workflow: {
        content: [{
          type: 'text',
          text: JSON.stringify({ workflow: { id: 'wf-new', status: 'draft' } }),
        }],
      },
    });

    const result = await createFacade(tools).createWorkflowDraft({
      name: 'Lead response',
      trigger: { type: 'contact_created' },
      actions: [{ type: 'sms', name: 'Welcome', attributes: { body: 'Hello' } }],
    });

    expect(result.created).toBe(true);
    expect(result.status).toBe('draft');
    expect(tools.calls[0]).toEqual({
      name: 'ghl_create_workflow',
      args: {
        name: 'Lead response',
        trigger: { type: 'contact_created' },
        actions: [{ type: 'sms', name: 'Welcome', attributes: { body: 'Hello' } }],
        publish: false,
      },
    });
  });

  test('previews communication without sending', async () => {
    const tools = new FakeToolCaller({});
    const result = await createFacade(tools).sendCommunication({
      channel: 'sms',
      contactId: 'contact-1',
      message: 'Hello',
    });

    expect(result.sent).toBe(false);
    expect(result.previewOnly).toBe(true);
    expect(tools.calls).toHaveLength(0);
  });

  test('deduplicates confirmed sends by idempotency key', async () => {
    const tools = new FakeToolCaller({
      send_sms: { success: true, messageId: 'msg-1' },
    });
    const facade = createFacade(tools);
    const input = {
      channel: 'sms' as const,
      contactId: 'contact-1',
      message: 'Hello',
      previewOnly: false,
      confirmation: 'SEND' as const,
      idempotencyKey: 'send-contact-1-hello',
    };

    const first = await facade.sendCommunication(input);
    const second = await facade.sendCommunication(input);

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(tools.calls.map(call => call.name)).toEqual(['send_sms']);
  });

  test('produces a partial account audit when one scope is unavailable', async () => {
    const tools = new FakeToolCaller({
      get_location: {
        location: {
          id: 'loc-123',
          name: 'Example',
          timezone: 'America/New_York',
          phone: '+15555550100',
          website: 'https://example.test',
          address: '1 Main St',
        },
      },
      get_calendars: { calendars: [{ id: 'cal-1' }] },
      get_location_custom_fields: { customFields: [{ id: 'field-1' }] },
      get_location_tags: { tags: [{ id: 'tag-1' }] },
      ghl_list_workflows: { workflows: [{ id: 'wf-1', status: 'active' }] },
      search_conversations: (args: Record<string, unknown>) => {
        if (args.status === 'unread') throw new Error('missing conversations.read scope');
        return { conversations: [{ id: 'conversation-1' }] };
      },
    });

    const result = await createFacade(tools).auditAccount('all');

    expect(result.partial).toBe(true);
    expect(result.metrics).toEqual({
      workflows: 1,
      calendars: 1,
      customFields: 1,
      tags: 1,
      conversationSample: 1,
      unreadConversationSample: 0,
    });
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: 'unreadConversations',
          severity: 'medium',
        }),
      ])
    );
  });
});
