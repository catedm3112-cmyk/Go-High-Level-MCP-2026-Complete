/**
 * GoHighLevel Phone System Tools
 * Tools for managing number pools and active phone numbers
 * (Separate from phone-tools.ts which covers phone number provisioning/messaging)
 */

import { GHLApiClient } from '../clients/ghl-api-client.js';

export class PhoneSystemTools {
  constructor(private ghlClient: GHLApiClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'list_number_pools',
        description: 'List all phone number pools available in the phone system. Number pools are groups of numbers used for call tracking and rotation.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to filter number pools (uses default if not provided)'
            },
            companyId: {
              type: 'string',
              description: 'Company/Agency ID to filter number pools'
            }
          }
        },
        _meta: {
          labels: {
            category: "phone-system",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'list_active_numbers_by_location',
        description: 'List all active phone numbers assigned to a specific location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to retrieve active numbers for (uses default if not provided)'
            }
          }
        },
        _meta: {
          labels: {
            category: "phone-system",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // ─── Number Search & Purchase ─────────────────────────────────────────
      {
        name: 'ghl_search_available_numbers',
        description: 'Search for available phone numbers to purchase. Filter by area code, country, number type (local/toll-free/mobile), and capabilities.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            areaCode: {
              type: 'string',
              description: 'Area code to search within (e.g., "415")'
            },
            country: {
              type: 'string',
              description: 'ISO 2-letter country code (default: "US")'
            },
            type: {
              type: 'string',
              enum: ['local', 'tollFree', 'mobile'],
              description: 'Type of phone number to search for'
            },
            capabilities: {
              type: 'array',
              items: { type: 'string', enum: ['voice', 'SMS', 'MMS'] },
              description: 'Required capabilities for the number'
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 20, max: 50)'
            }
          }
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_buy_phone_number',
        description: 'Purchase an available phone number for a location. The number will be billed to the location account.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to assign the number to (uses default if not provided)'
            },
            phoneNumber: {
              type: 'string',
              description: 'The phone number to purchase in E.164 format (e.g., "+14155551234")'
            },
            friendlyName: {
              type: 'string',
              description: 'Optional friendly label for the number'
            }
          },
          required: ['phoneNumber']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'write', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_release_phone_number',
        description: 'Release (remove) a purchased phone number from a location. This will stop billing for the number.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'The ID of the phone number to release'
            }
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'delete', complexity: 'simple' }
        }
      },

      // ─── Number Management ────────────────────────────────────────────────
      {
        name: 'ghl_get_phone_number',
        description: 'Get details for a specific purchased phone number including its settings, capabilities, and forwarding configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'The ID of the phone number to retrieve'
            }
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_list_phone_numbers',
        description: 'List all purchased phone numbers for a location with their current settings and status.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to list numbers for (uses default if not provided)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination (default: 0)'
            }
          }
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_update_phone_number',
        description: 'Update settings for a purchased phone number including forwarding rules, messaging, and friendly name.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'The ID of the phone number to update'
            },
            friendlyName: {
              type: 'string',
              description: 'Friendly display label for the number'
            },
            forwardingNumber: {
              type: 'string',
              description: 'Phone number to forward calls to (E.164 format)'
            },
            messagingEnabled: {
              type: 'boolean',
              description: 'Enable or disable SMS/MMS messaging for this number'
            },
            voiceEnabled: {
              type: 'boolean',
              description: 'Enable or disable voice calls for this number'
            }
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'write', complexity: 'simple' }
        }
      },

      // ─── Call Recordings ──────────────────────────────────────────────────
      {
        name: 'ghl_get_call_recording',
        description: 'Retrieve a specific call recording by its ID. Returns the recording URL and metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            recordingId: {
              type: 'string',
              description: 'The unique ID of the call recording'
            }
          },
          required: ['recordingId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_list_call_recordings',
        description: 'List call recordings for a location with optional date range and phone number filters.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'Filter recordings by phone number ID'
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)'
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of recordings to return (default: 20)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination'
            }
          }
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },

      // ─── Voicemail ────────────────────────────────────────────────────────
      {
        name: 'ghl_get_voicemail',
        description: 'Get voicemail messages for a specific phone number or location.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'Filter voicemails by phone number ID'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of voicemails to return (default: 20)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination'
            }
          }
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },

      // ─── Call Forwarding ──────────────────────────────────────────────────
      {
        name: 'ghl_configure_call_forwarding',
        description: 'Configure call forwarding rules for a phone number. Set up sequential or simultaneous ringing, time-based rules, and voicemail fallback.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            phoneNumberId: {
              type: 'string',
              description: 'The phone number ID to configure forwarding for'
            },
            forwardingNumber: {
              type: 'string',
              description: 'Primary forwarding destination (E.164 format)'
            },
            forwardingType: {
              type: 'string',
              enum: ['always', 'busyOrNoAnswer', 'scheduled'],
              description: 'When to forward calls'
            },
            voicemailEnabled: {
              type: 'boolean',
              description: 'Enable voicemail as fallback when forwarding fails'
            },
            greetingMessage: {
              type: 'string',
              description: 'Text for the greeting message (used with TTS if no recording)'
            }
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'write', complexity: 'moderate' }
        }
      },

      // ─── BYOC (Bring Your Own Carrier) ────────────────────────────────────
      {
        name: 'ghl_get_byoc_trunk',
        description: 'Get details for a specific BYOC (Bring Your Own Carrier) SIP trunk by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            trunkId: {
              type: 'string',
              description: 'The unique ID of the BYOC trunk'
            }
          },
          required: ['trunkId']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      },
      {
        name: 'ghl_create_byoc_trunk',
        description: 'Create a new BYOC (Bring Your Own Carrier) SIP trunk for a location. Allows using an external carrier instead of the built-in provider.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to create the trunk for (uses default if not provided)'
            },
            friendlyName: {
              type: 'string',
              description: 'Display name for the BYOC trunk'
            },
            sipDomain: {
              type: 'string',
              description: 'SIP domain/hostname of the carrier (e.g., "sip.carrier.com")'
            },
            sipUsername: {
              type: 'string',
              description: 'SIP authentication username'
            },
            sipPassword: {
              type: 'string',
              description: 'SIP authentication password'
            },
            sipPort: {
              type: 'number',
              description: 'SIP port (default: 5060)'
            }
          },
          required: ['friendlyName', 'sipDomain']
        },
        _meta: {
          labels: { category: 'phone-system', access: 'write', complexity: 'moderate' }
        }
      },
      {
        name: 'ghl_list_byoc_trunks',
        description: 'List all BYOC (Bring Your Own Carrier) SIP trunks configured for a location.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID to list trunks for (uses default if not provided)'
            }
          }
        },
        _meta: {
          labels: { category: 'phone-system', access: 'read', complexity: 'simple' }
        }
      }
    ];
  }

  async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const config = this.ghlClient.getConfig();
    const locationId = (args.locationId as string) || config.locationId;

    switch (toolName) {
      case 'list_number_pools': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        if (args.companyId) params.append('companyId', String(args.companyId));

        const query = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/number-pools${query ? `?${query}` : ''}`);
      }

      case 'list_active_numbers_by_location': {
        return this.ghlClient.makeRequest('GET', `/phone-system/numbers/location/${encodeURIComponent(locationId)}`, undefined, { version: 'v3' });
      }

      // ─── Number Search & Purchase ────────────────────────────────────────
      case 'ghl_search_available_numbers': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        if (args.areaCode) params.append('areaCode', String(args.areaCode));
        if (args.country) params.append('country', String(args.country));
        if (args.type) params.append('type', String(args.type));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.capabilities) {
          (args.capabilities as string[]).forEach(cap => params.append('capabilities', cap));
        }
        const qs = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/numbers/available${qs ? `?${qs}` : ''}`);
      }

      case 'ghl_buy_phone_number': {
        const body: Record<string, unknown> = { phoneNumber: args.phoneNumber };
        if (locationId) body.locationId = locationId;
        if (args.friendlyName) body.friendlyName = args.friendlyName;
        return this.ghlClient.makeRequest('POST', '/phone-system/numbers/buy', body);
      }

      case 'ghl_release_phone_number': {
        return this.ghlClient.makeRequest('DELETE', `/phone-system/numbers/${args.phoneNumberId}`);
      }

      // ─── Number Management ───────────────────────────────────────────────
      case 'ghl_get_phone_number': {
        return this.ghlClient.makeRequest('GET', `/phone-system/numbers/${args.phoneNumberId}`);
      }

      case 'ghl_list_phone_numbers': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.skip) params.append('skip', String(args.skip));
        const qs = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/numbers${qs ? `?${qs}` : ''}`);
      }

      case 'ghl_update_phone_number': {
        const body: Record<string, unknown> = {};
        if (args.friendlyName !== undefined) body.friendlyName = args.friendlyName;
        if (args.forwardingNumber !== undefined) body.forwardingNumber = args.forwardingNumber;
        if (args.messagingEnabled !== undefined) body.messagingEnabled = args.messagingEnabled;
        if (args.voiceEnabled !== undefined) body.voiceEnabled = args.voiceEnabled;
        return this.ghlClient.makeRequest('PATCH', `/phone-system/numbers/${args.phoneNumberId}`, body);
      }

      // ─── Call Recordings ─────────────────────────────────────────────────
      case 'ghl_get_call_recording': {
        return this.ghlClient.makeRequest('GET', `/phone-system/recordings/${args.recordingId}`);
      }

      case 'ghl_list_call_recordings': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        if (args.phoneNumberId) params.append('phoneNumberId', String(args.phoneNumberId));
        if (args.startDate) params.append('startDate', String(args.startDate));
        if (args.endDate) params.append('endDate', String(args.endDate));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.skip) params.append('skip', String(args.skip));
        const qs = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/recordings${qs ? `?${qs}` : ''}`);
      }

      // ─── Voicemail ───────────────────────────────────────────────────────
      case 'ghl_get_voicemail': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        if (args.phoneNumberId) params.append('phoneNumberId', String(args.phoneNumberId));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.skip) params.append('skip', String(args.skip));
        const qs = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/voicemail${qs ? `?${qs}` : ''}`);
      }

      // ─── Call Forwarding ────────────────────────────────────────────────
      case 'ghl_configure_call_forwarding': {
        const body: Record<string, unknown> = {};
        if (args.forwardingNumber !== undefined) body.forwardingNumber = args.forwardingNumber;
        if (args.forwardingType !== undefined) body.forwardingType = args.forwardingType;
        if (args.voicemailEnabled !== undefined) body.voicemailEnabled = args.voicemailEnabled;
        if (args.greetingMessage !== undefined) body.greetingMessage = args.greetingMessage;
        return this.ghlClient.makeRequest(
          'PATCH',
          `/phone-system/numbers/${args.phoneNumberId}/forwarding`,
          body,
        );
      }

      // ─── BYOC Trunks ─────────────────────────────────────────────────────
      case 'ghl_get_byoc_trunk': {
        return this.ghlClient.makeRequest('GET', `/phone-system/byoc/trunks/${args.trunkId}`);
      }

      case 'ghl_create_byoc_trunk': {
        const body: Record<string, unknown> = {
          friendlyName: args.friendlyName,
          sipDomain: args.sipDomain,
        };
        if (locationId) body.locationId = locationId;
        if (args.sipUsername) body.sipUsername = args.sipUsername;
        if (args.sipPassword) body.sipPassword = args.sipPassword;
        if (args.sipPort !== undefined) body.sipPort = args.sipPort;
        return this.ghlClient.makeRequest('POST', '/phone-system/byoc/trunks', body);
      }

      case 'ghl_list_byoc_trunks': {
        const params = new URLSearchParams();
        if (locationId) params.append('locationId', locationId);
        const qs = params.toString();
        return this.ghlClient.makeRequest('GET', `/phone-system/byoc/trunks${qs ? `?${qs}` : ''}`);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
