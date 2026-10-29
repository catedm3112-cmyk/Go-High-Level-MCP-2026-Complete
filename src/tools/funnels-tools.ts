/**
 * GoHighLevel Funnels Tools
 * Tools for managing funnels and funnel pages
 */

import { GHLApiClient } from '../clients/ghl-api-client.js';

export class FunnelsTools {
  constructor(private ghlClient: GHLApiClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_funnels',
        description: 'Get all funnels for a location. Funnels are multi-page sales/marketing flows.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of funnels to return (default: 10)'
            },
            name: {
              type: 'string',
              description: 'Filter by funnel name (partial match)'
            },
            category: {
              type: 'string',
              description: 'Filter by category'
            },
            parentId: {
              type: 'string',
              description: 'Filter by parent folder ID'
            },
            type: {
              type: 'string',
              enum: ['funnel', 'website'],
              description: 'Filter by type (funnel or website)'
            }
          }
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_funnel',
        description: 'Find a funnel or website by ID, including its step and page IDs. Use get_funnel_pages for the page records.',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID to retrieve'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['funnelId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_funnel_pages',
        description: 'Get all pages for a specific funnel',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID to get pages for'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of pages to return'
            },
          },
          required: ['funnelId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'count_funnel_pages',
        description: 'Get the total count of pages for a funnel',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['funnelId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_funnel_redirect',
        description: 'Create a URL redirect for a funnel',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            target: {
              type: 'string',
              description: 'Target URL to redirect to'
            },
            action: {
              type: 'string',
              enum: ['funnel', 'website', 'url', 'all'],
              description: 'Redirect action type'
            },
            pathName: {
              type: 'string',
              description: 'Source path for the redirect'
            },
          },
          required: ['funnelId', 'target', 'action']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_funnel_redirect',
        description: 'Update an existing funnel redirect',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID'
            },
            redirectId: {
              type: 'string',
              description: 'The redirect ID to update'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            target: {
              type: 'string',
              description: 'Target URL to redirect to'
            },
            action: {
              type: 'string',
              enum: ['funnel', 'website', 'url', 'all'],
              description: 'Redirect action type'
            },
            pathName: {
              type: 'string',
              description: 'Source path for the redirect'
            },
          },
          required: ['funnelId', 'redirectId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_funnel_redirect',
        description: 'Delete a funnel redirect',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID'
            },
            redirectId: {
              type: 'string',
              description: 'The redirect ID to delete'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['funnelId', 'redirectId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_funnel_redirects',
        description: 'List all redirects for a funnel',
        inputSchema: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'The funnel ID'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of redirects to return'
            },
          },
          required: ['funnelId']
        },
        _meta: {
          labels: {
            category: "funnels",
            access: "read",
            complexity: "simple"
          }
        }
      }
    ];
  }

  async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const config = this.ghlClient.getConfig();
    const locationId = (args.locationId as string) || config.locationId;

    switch (toolName) {
      case 'get_funnels': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.skip !== undefined) params.append('offset', String(args.skip));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.name) params.append('name', String(args.name));
        if (args.category) params.append('category', String(args.category));
        if (args.parentId) params.append('parentId', String(args.parentId));
        if (args.type) params.append('type', String(args.type));
        
        return this.ghlClient.makeRequest('GET', `/funnels/funnel/list?${params.toString()}`);
      }

      case 'get_funnel': {
        const funnelId = args.funnelId as string;
        // The public API has no GET /funnels/{id}. Look up the resource in its
        // location's inventory without assuming it is on the first page.
        for (let offset = 0; ; offset += 100) {
          const params = new URLSearchParams({ locationId, offset: String(offset), limit: '100' });
          const result = await this.ghlClient.makeRequest<any>('GET', `/funnels/funnel/list?${params}`);
          const data = result.data;
          if (!result.success || !data) return result;
          const funnels = Array.isArray(data.funnels) ? data.funnels : data.funnels?._id ? [data.funnels] : null;
          if (!funnels) throw new Error('Funnels API returned an invalid inventory response');
          const funnel = funnels.find((item: any) => (item._id || item.id) === funnelId);
          if (funnel) return { ...result, data: { funnel, traceId: data.traceId } };
          if (funnels.length < 100 || (Number.isFinite(data.count) && offset + funnels.length >= data.count)) break;
        }
        throw new Error('Funnel or website was not found in the requested location');
      }

      case 'get_funnel_pages': {
        const funnelId = args.funnelId as string;
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        params.append('funnelId', funnelId);
        params.append('offset', String(args.skip ?? 0));
        params.append('limit', String(args.limit ?? 10));
        
        return this.ghlClient.makeRequest('GET', `/funnels/page?${params.toString()}`);
      }

      case 'count_funnel_pages': {
        const funnelId = args.funnelId as string;
        return this.ghlClient.makeRequest('GET', `/funnels/${funnelId}/pages/count?locationId=${locationId}`);
      }

      case 'create_funnel_redirect': {
        const funnelId = args.funnelId as string;
        const body: Record<string, unknown> = {
          locationId,
          target: args.target,
          action: args.action
        };
        if (args.pathName) body.pathName = args.pathName;
        
        return this.ghlClient.makeRequest('POST', `/funnels/${funnelId}/redirect`, body);
      }

      case 'update_funnel_redirect': {
        const funnelId = args.funnelId as string;
        const redirectId = args.redirectId as string;
        const body: Record<string, unknown> = { locationId };
        if (args.target) body.target = args.target;
        if (args.action) body.action = args.action;
        if (args.pathName) body.pathName = args.pathName;
        
        return this.ghlClient.makeRequest('PATCH', `/funnels/${funnelId}/redirect/${redirectId}`, body);
      }

      case 'delete_funnel_redirect': {
        const funnelId = args.funnelId as string;
        const redirectId = args.redirectId as string;
        return this.ghlClient.makeRequest('DELETE', `/funnels/${funnelId}/redirect/${redirectId}?locationId=${locationId}`);
      }

      case 'get_funnel_redirects': {
        const funnelId = args.funnelId as string;
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.skip) params.append('skip', String(args.skip));
        if (args.limit) params.append('limit', String(args.limit));
        
        return this.ghlClient.makeRequest('GET', `/funnels/${funnelId}/redirect?${params.toString()}`);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
