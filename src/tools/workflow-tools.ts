import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GHLApiClient } from '../clients/ghl-api-client.js';
import { 
  MCPGetWorkflowsParams
} from '../types/ghl-types.js';

export class WorkflowTools {
  constructor(private apiClient: GHLApiClient) {}

  getTools(): Tool[] {
    return [
      {
        name: 'ghl_get_workflows',
        description: 'Retrieve all workflows for a location. Workflows represent automation sequences that can be triggered by various events in the system.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'The location ID to get workflows for. If not provided, uses the default location from configuration.'
            },
          },
          additionalProperties: false
        },
        _meta: {
          labels: {
            category: "workflows",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // ─── New Workflow Tools ───────────────────────────────────────────────
      {
        name: 'ghl_list_workflows',
        description: 'List all workflows in a location with status, trigger type, and step counts. Alias for ghl_get_workflows with additional filter options.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'draft'],
              description: 'Filter workflows by status'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of workflows to return (default: 50)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination'
            }
          },
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_get_workflow',
        description: 'Get full details for a specific workflow by ID, including all triggers, actions/steps, and configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            workflowId: {
              type: 'string',
              description: 'The unique ID of the workflow to retrieve'
            }
          },
          required: ['workflowId'],
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_update_workflow_status',
        description: 'Enable or disable a workflow. Active workflows process contacts; inactive ones are paused.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            workflowId: {
              type: 'string',
              description: 'The unique ID of the workflow to update'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              description: 'New status for the workflow'
            }
          },
          required: ['workflowId', 'status'],
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'write', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_delete_workflow',
        description: 'Permanently delete a workflow. All contacts currently in the workflow will be removed from it.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            workflowId: {
              type: 'string',
              description: 'The unique ID of the workflow to delete'
            }
          },
          required: ['workflowId'],
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'delete', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_trigger_workflow',
        description: 'Manually trigger a workflow for a specific contact. Useful for testing workflows or manually enrolling contacts.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            workflowId: {
              type: 'string',
              description: 'The unique ID of the workflow to trigger'
            },
            contactId: {
              type: 'string',
              description: 'The ID of the contact to enroll in the workflow'
            }
          },
          required: ['workflowId', 'contactId'],
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'write', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_get_workflow_executions',
        description: 'Get execution history for a workflow showing which contacts have run through it, their current step, and completion status.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID. Uses default if not provided.'
            },
            workflowId: {
              type: 'string',
              description: 'The unique ID of the workflow to get executions for'
            },
            contactId: {
              type: 'string',
              description: 'Filter executions by a specific contact ID'
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'cancelled', 'failed'],
              description: 'Filter by execution status'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of execution records to return (default: 20)'
            },
            skip: {
              type: 'number',
              description: 'Records to skip for pagination'
            }
          },
          required: ['workflowId'],
          additionalProperties: false
        },
        _meta: {
          labels: { category: 'workflows', access: 'read', complexity: 'simple' }
        }
      }
    ];
  }

  async executeWorkflowTool(name: string, params: any): Promise<any> {
    try {
      switch (name) {
        case 'ghl_get_workflows':
          return await this.getWorkflows(params as MCPGetWorkflowsParams);

        // ─── New Tools ──────────────────────────────────────────────────────
        case 'ghl_list_workflows':
          return await this.listWorkflows(params);

        case 'ghl_get_workflow':
          return await this.getWorkflowById(params);

        case 'ghl_update_workflow_status':
          return await this.updateWorkflowStatus(params);

        case 'ghl_delete_workflow':
          return await this.deleteWorkflow(params);

        case 'ghl_trigger_workflow':
          return await this.triggerWorkflow(params);

        case 'ghl_get_workflow_executions':
          return await this.getWorkflowExecutions(params);

        default:
          throw new Error(`Unknown workflow tool: ${name}`);
      }
    } catch (error) {
      console.error(`Error executing workflow tool ${name}:`, error);
      throw error;
    }
  }

  // ===== WORKFLOW MANAGEMENT TOOLS =====

  /**
   * Get all workflows for a location
   */
  private async getWorkflows(params: MCPGetWorkflowsParams): Promise<any> {
    try {
      const result = await this.apiClient.getWorkflows({
        locationId: params.locationId || ''
      });

      if (!result.success || !result.data) {
        throw new Error(`Failed to get workflows: ${result.error?.message || 'Unknown error'}`);
      }

      return {
        success: true,
        workflows: result.data.workflows,
        message: `Successfully retrieved ${result.data.workflows.length} workflows`,
        metadata: {
          totalWorkflows: result.data.workflows.length,
          workflowStatuses: result.data.workflows.reduce((acc: { [key: string]: number }, workflow) => {
            acc[workflow.status] = (acc[workflow.status] || 0) + 1;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      console.error('Error getting workflows:', error);
      throw new Error(`Failed to get workflows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ─── New Workflow Handlers ─────────────────────────────────────────────────

  private locationId(params: any): string {
    return params.locationId || (this.apiClient as any).getConfig?.()?.locationId || '';
  }

  private async listWorkflows(params: any): Promise<any> {
    const locationId = this.locationId(params);
    const qp = new URLSearchParams();
    if (locationId) qp.append('locationId', locationId);
    if (params.status) qp.append('status', params.status);
    if (params.limit) qp.append('limit', String(params.limit));
    if (params.skip) qp.append('skip', String(params.skip));
    const qs = qp.toString();
    return (this.apiClient as any).makeRequest('GET', `/workflows/${qs ? `?${qs}` : ''}`);
  }

  private async getWorkflowById(params: any): Promise<any> {
    const locationId = this.locationId(params);
    const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return (this.apiClient as any).makeRequest('GET', `/workflows/${params.workflowId}${qs}`);
  }

  private async updateWorkflowStatus(params: any): Promise<any> {
    const body: Record<string, unknown> = { status: params.status };
    const locationId = this.locationId(params);
    if (locationId) body.locationId = locationId;
    return (this.apiClient as any).makeRequest('PUT', `/workflows/${params.workflowId}`, body);
  }

  private async deleteWorkflow(params: any): Promise<any> {
    const locationId = this.locationId(params);
    const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return (this.apiClient as any).makeRequest('DELETE', `/workflows/${params.workflowId}${qs}`);
  }

  private async triggerWorkflow(params: any): Promise<any> {
    const locationId = this.locationId(params);
    const body: Record<string, unknown> = {
      contactId: params.contactId,
      ...(locationId && { locationId }),
    };
    return (this.apiClient as any).makeRequest('POST', `/workflows/${params.workflowId}/trigger`, body);
  }

  private async getWorkflowExecutions(params: any): Promise<any> {
    const locationId = this.locationId(params);
    const qp = new URLSearchParams();
    if (locationId) qp.append('locationId', locationId);
    if (params.contactId) qp.append('contactId', params.contactId);
    if (params.status) qp.append('status', params.status);
    if (params.startDate) qp.append('startDate', params.startDate);
    if (params.endDate) qp.append('endDate', params.endDate);
    if (params.limit) qp.append('limit', String(params.limit));
    if (params.skip) qp.append('skip', String(params.skip));
    const qs = qp.toString();
    return (this.apiClient as any).makeRequest('GET', `/workflows/${params.workflowId}/executions${qs ? `?${qs}` : ''}`);
  }
}

// Helper function to check if a tool name belongs to workflow tools
export function isWorkflowTool(toolName: string): boolean {
  const workflowToolNames = [
    'ghl_get_workflows',
    'ghl_list_workflows',
    'ghl_get_workflow',
    'ghl_update_workflow_status',
    'ghl_delete_workflow',
    'ghl_trigger_workflow',
    'ghl_get_workflow_executions',
  ];
  
  return workflowToolNames.includes(toolName);
} 