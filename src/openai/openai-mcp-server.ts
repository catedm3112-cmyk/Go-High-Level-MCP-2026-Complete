import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  OpenAIGHLFacade,
  CreateWorkflowDraftInput,
  SendCommunicationInput,
} from './tool-facade.js';

function textResult(value: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(value),
    }],
  };
}

const actionSchema = z.object({
  type: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  attributes: z.record(z.string(), z.unknown()).optional(),
  id: z.string().optional(),
  next: z.array(z.string()).optional(),
  parentKey: z.string().optional(),
  cat: z.string().optional(),
  nodeType: z.string().optional(),
});

const triggerSchema = z.object({
  type: z.string().min(1).max(80),
  name: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export function createOpenAIMcpServer(facade: OpenAIGHLFacade): McpServer {
  const server = new McpServer(
    { name: 'ghl-openai-gateway', version: '1.0.0' },
    {
      instructions:
        'Use search and fetch before acting when an identifier or current state is unknown. ' +
        'Create workflows as drafts only. Preview communications before sending; send only after the user confirms. ' +
        'Account audits are read-only and may be partial when the connected GHL token lacks a required scope.',
    }
  );

  server.registerTool(
    'search',
    {
      title: 'Search GHL',
      description:
        'Use this when you need to find GHL workflows, contacts, conversations, or the account audit resource from a natural-language query.',
      inputSchema: z.object({
        query: z.string().min(1).max(300),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) => textResult(await facade.search(query))
  );

  server.registerTool(
    'fetch',
    {
      title: 'Fetch GHL resource',
      description:
        'Use this when you have an ID returned by search and need the current workflow, contact, conversation, or account-audit details.',
      inputSchema: z.object({
        id: z.string().min(3).max(300),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => textResult(await facade.fetch(id))
  );

  server.registerTool(
    'audit_account',
    {
      title: 'Audit GHL account',
      description:
        'Use this when the user wants a read-only health check of GHL configuration, workflows, communications, or all three areas.',
      inputSchema: z.object({
        scope: z.enum(['all', 'configuration', 'workflows', 'communications']).default('all'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ scope }) => textResult(await facade.auditAccount(scope))
  );

  server.registerTool(
    'create_workflow_draft',
    {
      title: 'Create workflow draft',
      description:
        'Use this when the user wants to create a new GHL workflow. It always creates a draft and never publishes or activates it.',
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        trigger: triggerSchema.optional(),
        actions: z.array(actionSchema).max(50).default([]),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async input => textResult(
      await facade.createWorkflowDraft(input as CreateWorkflowDraftInput)
    )
  );

  server.registerTool(
    'send_communication',
    {
      title: 'Preview or send communication',
      description:
        'Use this to preview or send one SMS or email to a known GHL contact. Preview first. Sending requires previewOnly=false, confirmation="SEND", and an idempotencyKey.',
      inputSchema: z.object({
        channel: z.enum(['sms', 'email']),
        contactId: z.string().min(1).max(120),
        message: z.string().min(1).max(10_000),
        subject: z.string().max(300).optional(),
        html: z.string().max(50_000).optional(),
        fromNumber: z.string().max(50).optional(),
        emailFrom: z.string().max(320).optional(),
        previewOnly: z.boolean().default(true),
        confirmation: z.literal('SEND').optional(),
        idempotencyKey: z.string().min(8).max(200).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async input => textResult(
      await facade.sendCommunication(input as SendCommunicationInput)
    )
  );

  return server;
}
