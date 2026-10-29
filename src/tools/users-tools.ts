/**
 * GoHighLevel Users Tools
 * Tools for managing users and team members
 */

import { GHLApiClient } from '../clients/ghl-api-client.js';

export class UsersTools {
  constructor(private ghlClient: GHLApiClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_users',
        description: 'Get users/team members for a location, including roles and permissions. Filtering, sorting, and pagination are applied locally because the location-users API accepts only locationId.',
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
              description: 'Maximum number of users to return (max: 100). Omit to return all matching users.'
            },
            type: {
              type: 'string',
              description: 'Filter by user type'
            },
            role: {
              type: 'string',
              description: 'Filter by role (e.g., "admin", "user")'
            },
            ids: {
              type: 'string',
              description: 'Comma-separated list of user IDs to filter'
            },
            sort: {
              type: 'string',
              description: 'Sort field'
            },
            sortDirection: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction'
            }
          }
        },
        _meta: {
          labels: {
            category: "users",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_user',
        description: 'Get a specific user by their ID',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to retrieve'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_user',
        description: 'Create a new user/team member for a location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            type: {
              type: 'string',
              description: 'User type (e.g., "account")'
            },
            role: {
              type: 'string',
              description: 'User role (e.g., "admin", "user")'
            },
            permissions: {
              type: 'object',
              description: 'User permissions object'
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              description: 'OAuth scopes for the user'
            },
            scopesAssignedToOnly: {
              type: 'array',
              items: { type: 'string' },
              description: 'Scopes only assigned to this user'
            },
          },
          required: ['firstName', 'lastName', 'email']
        },
        _meta: {
          labels: {
            category: "users",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_user',
        description: 'Update an existing user/team member',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to update'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            type: {
              type: 'string',
              description: 'User type'
            },
            role: {
              type: 'string',
              description: 'User role'
            },
            permissions: {
              type: 'object',
              description: 'User permissions object'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_user',
        description: 'Delete a user/team member from a location',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to delete'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'search_users',
        description: 'Search for users across a company/agency by email, name, or other criteria',
        inputSchema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID to search within'
            },
            query: {
              type: 'string',
              description: 'Search query string'
            },
            skip: {
              type: 'number',
              description: 'Records to skip'
            },
            limit: {
              type: 'number',
              description: 'Max records to return'
            }
          }
        }
      },
      {
        name: 'filter_users_by_email',
        description: 'Filter/look up users by email address within a location',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email address to search for'
            },
            locationId: {
              type: 'string',
              description: 'Location ID to filter within (uses default if not provided)'
            }
          },
          required: ['email']
        },
        _meta: {
          labels: {
            category: "users",
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
      case 'get_users': {
        // GET /users/ rejects extra query parameters with 422. Keep the existing
        // MCP filter arguments, but apply them to this subaccount's result.
        const result = await this.ghlClient.makeRequest('GET', `/users/?${new URLSearchParams({ locationId })}`);
        const data = result?.data;
        if (!Array.isArray(data?.users)) return result;
        const ids = args.ids ? new Set(String(args.ids).split(',').map(id => id.trim()).filter(Boolean)) : null;
        const users = data.users.filter((user: any) =>
          (!ids || ids.has(user.id)) &&
          (!args.type || (user.roles?.type ?? user.type) === args.type) &&
          (!args.role || (user.roles?.role ?? user.role) === args.role)
        );
        if (args.sort) {
          const field = String(args.sort);
          const direction = args.sortDirection === 'desc' ? -1 : 1;
          users.sort((a: any, b: any) => direction * String(a[field] ?? '').localeCompare(String(b[field] ?? '')));
        }
        const skip = Math.max(0, Math.trunc(Number(args.skip) || 0));
        const limit = Number(args.limit) > 0 ? Math.min(100, Math.trunc(Number(args.limit))) : users.length;
        const page = users.slice(skip, skip + limit);
        return { ...result, data: { ...data, users: page, total: users.length, returned: page.length } };
      }

      case 'get_user': {
        const userId = args.userId as string;
        return this.ghlClient.makeRequest('GET', `/users/${userId}`);
      }

      case 'create_user': {
        const body: Record<string, unknown> = {
          locationId,
          firstName: args.firstName,
          lastName: args.lastName,
          email: args.email
        };
        if (args.phone) body.phone = args.phone;
        if (args.type) body.type = args.type;
        if (args.role) body.role = args.role;
        if (args.permissions) body.permissions = args.permissions;
        if (args.scopes) body.scopes = args.scopes;
        if (args.scopesAssignedToOnly) body.scopesAssignedToOnly = args.scopesAssignedToOnly;
        
        return this.ghlClient.makeRequest('POST', `/users/`, body);
      }

      case 'update_user': {
        const userId = args.userId as string;
        const body: Record<string, unknown> = {};
        if (args.firstName) body.firstName = args.firstName;
        if (args.lastName) body.lastName = args.lastName;
        if (args.email) body.email = args.email;
        if (args.phone) body.phone = args.phone;
        if (args.type) body.type = args.type;
        if (args.role) body.role = args.role;
        if (args.permissions) body.permissions = args.permissions;
        
        return this.ghlClient.makeRequest('PUT', `/users/${userId}`, body);
      }

      case 'delete_user': {
        const userId = args.userId as string;
        return this.ghlClient.makeRequest('DELETE', `/users/${userId}`);
      }

      case 'search_users': {
        const params = new URLSearchParams();
        if (args.companyId) params.append('companyId', String(args.companyId));
        if (args.query) params.append('query', String(args.query));
        if (args.skip) params.append('skip', String(args.skip));
        if (args.limit) params.append('limit', String(args.limit));
        
        return this.ghlClient.makeRequest('GET', `/users/search?${params.toString()}`);
      }

      case 'filter_users_by_email': {
        const body: Record<string, unknown> = {
          email: args.email,
          locationId
        };
        return this.ghlClient.makeRequest('POST', `/users/search/filter-by-email`, body);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
