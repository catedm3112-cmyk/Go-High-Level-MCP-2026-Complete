/**
 * OpenAI-facing GHL MCP gateway.
 *
 * This is intentionally separate from the broad Claude-facing server. It
 * exposes five focused tools and reuses one GHL client/registry per process.
 */

import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { EnhancedGHLClient } from './enhanced-ghl-client.js';
import { ToolRegistry } from './tool-registry.js';
import { GHLConfig } from './types/ghl-types.js';
import { OpenAIGHLFacade } from './openai/tool-facade.js';
import { createOpenAIMcpServer } from './openai/openai-mcp-server.js';

dotenv.config();

function authorized(req: express.Request): boolean {
  const expected = process.env.OPENAI_MCP_BEARER_TOKEN;
  if (!expected) return true;
  return req.headers.authorization === `Bearer ${expected}`;
}

export async function startOpenAIGateway(): Promise<void> {
  const port = Number.parseInt(process.env.OPENAI_MCP_PORT || process.env.PORT || '8001', 10);
  const config: GHLConfig = {
    accessToken: process.env.GHL_API_KEY || '',
    baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
    version: '2021-07-28',
    locationId: process.env.GHL_LOCATION_ID || '',
  };

  if (!config.accessToken) throw new Error('GHL_API_KEY is required');
  if (!config.locationId) throw new Error('GHL_LOCATION_ID is required');

  const publicBaseUrl =
    process.env.OPENAI_MCP_PUBLIC_BASE_URL ||
    `http://localhost:${port}`;

  // One shared client and registry per process preserves connection pooling,
  // rate-limit state, and safe read caches.
  const client = new EnhancedGHLClient(config);
  const registry = new ToolRegistry(client);
  const facade = new OpenAIGHLFacade(registry, {
    locationId: config.locationId,
    publicBaseUrl,
  });

  if (process.env.VERIFY_GHL_ON_START === 'true') {
    await client.testConnection();
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      if (!origin ||
          origin === 'https://chatgpt.com' ||
          origin === 'https://chat.openai.com' ||
          /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin is not allowed'));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id'],
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      server: 'ghl-openai-gateway',
      version: '1.0.0',
      endpoint: '/mcp',
      tools: 5,
    });
  });

  app.get('/openai/resources/:kind/:id', async (req, res) => {
    if (!authorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const resource = await facade.fetch(`${req.params.kind}:${req.params.id}`);
      res.json(resource);
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.all('/mcp', async (req, res) => {
    if (!authorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const server = createOpenAIMcpServer(facade);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  });

  app.listen(port, '0.0.0.0', () => {
    process.stderr.write(
      `[GHL OpenAI] Listening on http://0.0.0.0:${port}/mcp with 5 tools\n`
    );
  });
}

startOpenAIGateway().catch(error => {
  process.stderr.write(`[GHL OpenAI] Fatal: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
