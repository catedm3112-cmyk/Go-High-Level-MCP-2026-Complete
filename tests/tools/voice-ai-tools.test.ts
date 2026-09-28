/**
 * Regression: update_voice_ai_agent sent locationId in the PATCH body and GHL answered
 * 422 "property locationId should not exist". PATCH /voice-ai/agents/{id} takes it as a
 * query param only.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { VoiceAITools } from '../../src/tools/voice-ai-tools.js';

type Call = { method: string; path: string; body?: Record<string, unknown> };

function fakeClient(locationId = 'locDefault') {
  const calls: Call[] = [];
  const client = {
    getConfig: () => ({ locationId }),
    makeRequest: jest.fn(async (method: string, path: string, body?: Record<string, unknown>) => {
      calls.push({ method, path, body });
      return { success: true, data: {} };
    }),
  };
  return { client, calls };
}

describe('VoiceAITools update_voice_ai_agent', () => {
  it('keeps locationId out of the PATCH body and in the query string', async () => {
    const { client, calls } = fakeClient();
    await new VoiceAITools(client as any).handleToolCall('update_voice_ai_agent', {
      agentId: 'agent1', locationId: 'locOther', agentPrompt: 'hello',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].path).toBe('/voice-ai/agents/agent1?locationId=locOther');
    expect(calls[0].body).toEqual({ agentPrompt: 'hello' });
  });

  it('falls back to the bound sub-account for the query param', async () => {
    const { client, calls } = fakeClient('locBound');
    await new VoiceAITools(client as any).handleToolCall('update_voice_ai_agent', {
      agentId: 'agent1', agentName: 'x',
    });
    expect(calls[0].path).toBe('/voice-ai/agents/agent1?locationId=locBound');
    expect(calls[0].body).not.toHaveProperty('locationId');
  });

  it('forwards idle-reminder and post-call workflow settings, including false / empty values', async () => {
    const { client, calls } = fakeClient();
    await new VoiceAITools(client as any).handleToolCall('update_voice_ai_agent', {
      agentId: 'agent1', sendUserIdleReminders: false, reminderAfterIdleTimeSeconds: 8, callEndWorkflowIds: [],
    });
    expect(calls[0].body).toEqual({ sendUserIdleReminders: false, reminderAfterIdleTimeSeconds: 8, callEndWorkflowIds: [] });
  });

  it('exposes those settings in the tool schema so clients can send them', () => {
    const tool = new VoiceAITools(fakeClient().client as any)
      .getToolDefinitions().find(t => t.name === 'update_voice_ai_agent')!;
    const props = tool.inputSchema.properties as Record<string, any>;
    expect(props.sendUserIdleReminders.type).toBe('boolean');
    expect(props.reminderAfterIdleTimeSeconds.type).toBe('number');
    expect(props.callEndWorkflowIds).toMatchObject({ type: 'array', items: { type: 'string' } });
  });
});
