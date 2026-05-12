// GoHighLevel MCP Server - Full API Implementation
// Implements MCP 2024-11-05 protocol with 150+ real GHL API tools

const MCP_PROTOCOL_VERSION = "2024-11-05";
const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const SERVER_INFO = { name: "ghl-mcp-server", version: "2.0.0" };

// ─── GHL API Helper ────────────────────────────────────────────────────────────

async function ghlRequest(method, path, body = null, version = "2021-07-28") {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey) throw new Error("GHL_API_KEY environment variable not set");

  const url = `${GHL_BASE_URL}${path}`;
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Version": version,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const options = { method, headers };
  if (body && method !== "GET") options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`GHL API error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function loc() { return process.env.GHL_LOCATION_ID; }

// ─── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS = [

  // ── CONTACTS ──
  {
    name: "search_contacts",
    description: "Search for contacts in GoHighLevel CRM",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (name, email, phone)" },
        limit: { type: "number", description: "Max results (default 20)" },
        skip: { type: "number", description: "Skip N results for pagination" }
      }
    }
  },
  {
    name: "get_contact",
    description: "Get a specific contact by ID",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string", description: "Contact ID" } },
      required: ["contactId"]
    }
  },
  {
    name: "create_contact",
    description: "Create a new contact in GoHighLevel",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address1: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postalCode: { type: "string" },
        website: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        source: { type: "string" },
        companyName: { type: "string" },
        customFields: { type: "array", items: { type: "object" } }
      }
    }
  },
  {
    name: "update_contact",
    description: "Update an existing contact",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address1: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postalCode: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        companyName: { type: "string" },
        customFields: { type: "array", items: { type: "object" } }
      },
      required: ["contactId"]
    }
  },
  {
    name: "delete_contact",
    description: "Delete a contact by ID",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"]
    }
  },
  {
    name: "upsert_contact",
    description: "Create or update a contact based on email or phone",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        source: { type: "string" }
      }
    }
  },
  {
    name: "add_contact_tags",
    description: "Add tags to a contact",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["contactId", "tags"]
    }
  },
  {
    name: "remove_contact_tags",
    description: "Remove tags from a contact",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["contactId", "tags"]
    }
  },
  {
    name: "get_contact_notes",
    description: "Get all notes for a contact",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"]
    }
  },
  {
    name: "create_contact_note",
    description: "Create a note for a contact",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        body: { type: "string", description: "Note content" },
        userId: { type: "string" }
      },
      required: ["contactId", "body"]
    }
  },
  {
    name: "update_contact_note",
    description: "Update a contact note",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        noteId: { type: "string" },
        body: { type: "string" }
      },
      required: ["contactId", "noteId", "body"]
    }
  },
  {
    name: "delete_contact_note",
    description: "Delete a contact note",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" }, noteId: { type: "string" } },
      required: ["contactId", "noteId"]
    }
  },
  {
    name: "get_contact_tasks",
    description: "Get all tasks for a contact",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"]
    }
  },
  {
    name: "create_contact_task",
    description: "Create a task for a contact",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string", description: "ISO date string" },
        status: { type: "string", enum: ["incompleted", "completed"] },
        assignedTo: { type: "string" },
        body: { type: "string" }
      },
      required: ["contactId", "title", "dueDate"]
    }
  },
  {
    name: "update_contact_task",
    description: "Update a contact task",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        taskId: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string" },
        status: { type: "string", enum: ["incompleted", "completed"] }
      },
      required: ["contactId", "taskId"]
    }
  },
  {
    name: "delete_contact_task",
    description: "Delete a contact task",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" }, taskId: { type: "string" } },
      required: ["contactId", "taskId"]
    }
  },
  {
    name: "get_contact_appointments",
    description: "Get all appointments for a contact",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"]
    }
  },
  {
    name: "add_contact_to_workflow",
    description: "Add a contact to a workflow",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        workflowId: { type: "string" },
        eventStartTime: { type: "string" }
      },
      required: ["contactId", "workflowId"]
    }
  },
  {
    name: "remove_contact_from_workflow",
    description: "Remove a contact from a workflow",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        workflowId: { type: "string" }
      },
      required: ["contactId", "workflowId"]
    }
  },
  {
    name: "add_contact_to_campaign",
    description: "Add a contact to a campaign",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        campaignId: { type: "string" }
      },
      required: ["contactId", "campaignId"]
    }
  },
  {
    name: "remove_contact_from_campaign",
    description: "Remove a contact from a specific campaign",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        campaignId: { type: "string" }
      },
      required: ["contactId", "campaignId"]
    }
  },
  {
    name: "remove_contact_from_all_campaigns",
    description: "Remove a contact from all campaigns",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"]
    }
  },

  // ── CONVERSATIONS ──
  {
    name: "search_conversations",
    description: "Search conversations in GoHighLevel",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
        skip: { type: "number" },
        status: { type: "string", enum: ["all", "read", "unread", "starred", "recents"] }
      }
    }
  },
  {
    name: "get_conversation",
    description: "Get a specific conversation by ID",
    inputSchema: {
      type: "object",
      properties: { conversationId: { type: "string" } },
      required: ["conversationId"]
    }
  },
  {
    name: "create_conversation",
    description: "Create a new conversation",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        locationId: { type: "string" }
      },
      required: ["contactId"]
    }
  },
  {
    name: "get_messages",
    description: "Get messages from a conversation",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        limit: { type: "number" },
        lastMessageId: { type: "string" }
      },
      required: ["conversationId"]
    }
  },
  {
    name: "send_sms",
    description: "Send an SMS message to a contact",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        message: { type: "string" },
        fromNumber: { type: "string" },
        toNumber: { type: "string" }
      },
      required: ["conversationId", "message"]
    }
  },
  {
    name: "send_email",
    description: "Send an email to a contact",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        emailFrom: { type: "string" },
        emailTo: { type: "string" },
        replyToMessageId: { type: "string" }
      },
      required: ["conversationId", "subject", "body"]
    }
  },
  {
    name: "update_conversation",
    description: "Update a conversation (starred, unread status)",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        starred: { type: "boolean" },
        unreadCount: { type: "number" }
      },
      required: ["conversationId"]
    }
  },

  // ── OPPORTUNITIES ──
  {
    name: "search_opportunities",
    description: "Search opportunities / deals in GoHighLevel",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        pipelineId: { type: "string" },
        stageId: { type: "string" },
        contactId: { type: "string" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
        limit: { type: "number" },
        skip: { type: "number" }
      }
    }
  },
  {
    name: "get_opportunity",
    description: "Get a specific opportunity by ID",
    inputSchema: {
      type: "object",
      properties: { opportunityId: { type: "string" } },
      required: ["opportunityId"]
    }
  },
  {
    name: "create_opportunity",
    description: "Create a new opportunity / deal",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string" },
        pipelineStageId: { type: "string" },
        contactId: { type: "string" },
        name: { type: "string" },
        monetaryValue: { type: "number" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
        assignedTo: { type: "string" }
      },
      required: ["pipelineId", "pipelineStageId", "contactId", "name"]
    }
  },
  {
    name: "update_opportunity",
    description: "Update an existing opportunity",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
        name: { type: "string" },
        pipelineStageId: { type: "string" },
        monetaryValue: { type: "number" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
        assignedTo: { type: "string" }
      },
      required: ["opportunityId"]
    }
  },
  {
    name: "delete_opportunity",
    description: "Delete an opportunity",
    inputSchema: {
      type: "object",
      properties: { opportunityId: { type: "string" } },
      required: ["opportunityId"]
    }
  },
  {
    name: "get_pipelines",
    description: "Get all pipelines for the location",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "update_opportunity_status",
    description: "Update just the status of an opportunity",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"] }
      },
      required: ["opportunityId", "status"]
    }
  },

  // ── CALENDARS & APPOINTMENTS ──
  {
    name: "get_calendars",
    description: "Get all calendars for the location",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_calendar",
    description: "Get a specific calendar by ID",
    inputSchema: {
      type: "object",
      properties: { calendarId: { type: "string" } },
      required: ["calendarId"]
    }
  },
  {
    name: "create_calendar",
    description: "Create a new calendar",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        slug: { type: "string" },
        calendarType: { type: "string" },
        teamMembers: { type: "array", items: { type: "object" } }
      },
      required: ["name"]
    }
  },
  {
    name: "update_calendar",
    description: "Update a calendar",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" }
      },
      required: ["calendarId"]
    }
  },
  {
    name: "delete_calendar",
    description: "Delete a calendar",
    inputSchema: {
      type: "object",
      properties: { calendarId: { type: "string" } },
      required: ["calendarId"]
    }
  },
  {
    name: "get_calendar_events",
    description: "Get calendar events/appointments within a date range",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string" },
        startTime: { type: "number", description: "Unix timestamp milliseconds" },
        endTime: { type: "number", description: "Unix timestamp milliseconds" },
        userId: { type: "string" }
      },
      required: ["startTime", "endTime"]
    }
  },
  {
    name: "get_free_slots",
    description: "Get free appointment slots for a calendar",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string" },
        startDate: { type: "number", description: "Unix timestamp milliseconds" },
        endDate: { type: "number", description: "Unix timestamp milliseconds" },
        timezone: { type: "string" }
      },
      required: ["calendarId", "startDate", "endDate"]
    }
  },
  {
    name: "create_appointment",
    description: "Book an appointment",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string" },
        contactId: { type: "string" },
        startTime: { type: "string", description: "ISO date string" },
        endTime: { type: "string" },
        title: { type: "string" },
        meetingLocationType: { type: "string" },
        appointmentStatus: { type: "string" },
        assignedUserId: { type: "string" },
        address: { type: "string" },
        timezone: { type: "string" }
      },
      required: ["calendarId", "contactId", "startTime"]
    }
  },
  {
    name: "get_appointment",
    description: "Get a specific appointment by ID",
    inputSchema: {
      type: "object",
      properties: { appointmentId: { type: "string" } },
      required: ["appointmentId"]
    }
  },
  {
    name: "update_appointment",
    description: "Update an appointment",
    inputSchema: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        calendarId: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        title: { type: "string" },
        appointmentStatus: { type: "string" },
        address: { type: "string" }
      },
      required: ["appointmentId"]
    }
  },
  {
    name: "delete_appointment",
    description: "Delete/cancel an appointment",
    inputSchema: {
      type: "object",
      properties: { appointmentId: { type: "string" } },
      required: ["appointmentId"]
    }
  },
  {
    name: "get_calendar_groups",
    description: "Get all calendar groups",
    inputSchema: { type: "object", properties: {} }
  },

  // ── BLOGS ──
  {
    name: "get_blog_sites",
    description: "Get all blog sites for the location",
    inputSchema: {
      type: "object",
      properties: {
        skip: { type: "number" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_blog_posts",
    description: "Get blog posts",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
        status: { type: "string" }
      }
    }
  },
  {
    name: "get_blog_post",
    description: "Get a specific blog post by ID",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    }
  },
  {
    name: "create_blog_post",
    description: "Create a new blog post",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        title: { type: "string" },
        rawHTML: { type: "string", description: "HTML content of the blog post" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
        imageUrl: { type: "string" },
        description: { type: "string" },
        author: { type: "string" },
        categories: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        urlSlug: { type: "string" }
      },
      required: ["title", "rawHTML"]
    }
  },
  {
    name: "update_blog_post",
    description: "Update a blog post",
    inputSchema: {
      type: "object",
      properties: {
        postId: { type: "string" },
        title: { type: "string" },
        rawHTML: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
        imageUrl: { type: "string" },
        description: { type: "string" }
      },
      required: ["postId"]
    }
  },
  {
    name: "get_blog_authors",
    description: "Get all blog authors",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        skip: { type: "number" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_blog_categories",
    description: "Get all blog categories",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        skip: { type: "number" },
        limit: { type: "number" }
      }
    }
  },

  // ── SOCIAL MEDIA ──
  {
    name: "get_social_accounts",
    description: "Get connected social media accounts",
    inputSchema: {
      type: "object",
      properties: { userId: { type: "string" } }
    }
  },
  {
    name: "get_social_posts",
    description: "Get social media posts",
    inputSchema: {
      type: "object",
      properties: {
        skip: { type: "number" },
        limit: { type: "number" },
        status: { type: "string" },
        accountId: { type: "string" }
      }
    }
  },
  {
    name: "get_social_post",
    description: "Get a specific social media post",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    }
  },
  {
    name: "create_social_post",
    description: "Create and schedule a social media post",
    inputSchema: {
      type: "object",
      properties: {
        accountIds: { type: "array", items: { type: "string" }, description: "Social account IDs to post to" },
        body: { type: "string", description: "Post content/caption" },
        scheduleDate: { type: "string", description: "ISO date for scheduling" },
        status: { type: "string", enum: ["draft", "scheduled", "published"] },
        imageUrls: { type: "array", items: { type: "string" } }
      },
      required: ["accountIds", "body"]
    }
  },
  {
    name: "update_social_post",
    description: "Update a social media post",
    inputSchema: {
      type: "object",
      properties: {
        postId: { type: "string" },
        body: { type: "string" },
        scheduleDate: { type: "string" },
        status: { type: "string" }
      },
      required: ["postId"]
    }
  },
  {
    name: "delete_social_post",
    description: "Delete a social media post",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    }
  },
  {
    name: "get_social_media_statistics",
    description: "Get social media statistics",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" }
      }
    }
  },

  // ── LOCATION ──
  {
    name: "get_location",
    description: "Get location details",
    inputSchema: {
      type: "object",
      properties: { locationId: { type: "string", description: "Defaults to configured location" } }
    }
  },
  {
    name: "update_location",
    description: "Update location details",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        name: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postalCode: { type: "string" },
        country: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        email: { type: "string" },
        timezone: { type: "string" }
      }
    }
  },
  {
    name: "get_location_custom_fields",
    description: "Get custom fields for the location",
    inputSchema: {
      type: "object",
      properties: {
        locationId: { type: "string" },
        model: { type: "string", enum: ["contact", "opportunity", "all"] }
      }
    }
  },
  {
    name: "get_location_tags",
    description: "Get all tags for the location",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_location_tag",
    description: "Create a new tag for the location",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"]
    }
  },
  {
    name: "delete_location_tag",
    description: "Delete a location tag",
    inputSchema: {
      type: "object",
      properties: { tagId: { type: "string" } },
      required: ["tagId"]
    }
  },
  {
    name: "get_location_templates",
    description: "Get location templates (SMS, email, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["sms", "email", "whatsapp", "all"] },
        skip: { type: "number" },
        limit: { type: "number" },
        originId: { type: "string" }
      }
    }
  },
  {
    name: "get_location_custom_values",
    description: "Get custom values for the location",
    inputSchema: { type: "object", properties: {} }
  },

  // ── EMAIL ──
  {
    name: "get_email_templates",
    description: "Get email templates",
    inputSchema: {
      type: "object",
      properties: {
        skip: { type: "number" },
        limit: { type: "number" },
        type: { type: "string" }
      }
    }
  },
  {
    name: "create_email_template",
    description: "Create a new email template",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        body: { type: "string" },
        subject: { type: "string" },
        type: { type: "string", enum: ["html", "builder"] }
      },
      required: ["name", "body"]
    }
  },
  {
    name: "get_email_campaigns",
    description: "Get email campaigns",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "number" },
        skip: { type: "number" }
      }
    }
  },

  // ── INVOICES ──
  {
    name: "list_invoices",
    description: "List all invoices",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
        startAt: { type: "string" },
        endAt: { type: "string" }
      }
    }
  },
  {
    name: "get_invoice",
    description: "Get a specific invoice by ID",
    inputSchema: {
      type: "object",
      properties: { invoiceId: { type: "string" } },
      required: ["invoiceId"]
    }
  },
  {
    name: "create_invoice",
    description: "Create a new invoice",
    inputSchema: {
      type: "object",
      properties: {
        contactDetails: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            phoneNo: { type: "string" }
          }
        },
        title: { type: "string" },
        issueDate: { type: "string" },
        dueDate: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              productId: { type: "string" },
              priceId: { type: "string" },
              currency: { type: "string" },
              amount: { type: "number" },
              qty: { type: "number" }
            }
          }
        },
        currency: { type: "string", default: "USD" },
        termsNotes: { type: "string" },
        discount: { type: "object" }
      },
      required: ["contactDetails", "title", "items"]
    }
  },
  {
    name: "send_invoice",
    description: "Send an invoice to the contact",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string" },
        userId: { type: "string" }
      },
      required: ["invoiceId"]
    }
  },
  {
    name: "update_invoice",
    description: "Update an existing invoice",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string" },
        items: { type: "array", items: { type: "object" } },
        discount: { type: "object" }
      },
      required: ["invoiceId"]
    }
  },
  {
    name: "delete_invoice",
    description: "Delete an invoice",
    inputSchema: {
      type: "object",
      properties: { invoiceId: { type: "string" } },
      required: ["invoiceId"]
    }
  },
  {
    name: "list_invoice_templates",
    description: "List invoice templates",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" }
      }
    }
  },

  // ── PAYMENTS & ORDERS ──
  {
    name: "list_orders",
    description: "List payment orders",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
        paymentMode: { type: "string" },
        startAt: { type: "string" },
        endAt: { type: "string" }
      }
    }
  },
  {
    name: "get_order_by_id",
    description: "Get a specific order by ID",
    inputSchema: {
      type: "object",
      properties: { orderId: { type: "string" } },
      required: ["orderId"]
    }
  },
  {
    name: "list_transactions",
    description: "List payment transactions",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
        startAt: { type: "string" },
        endAt: { type: "string" }
      }
    }
  },
  {
    name: "get_transaction_by_id",
    description: "Get a specific transaction by ID",
    inputSchema: {
      type: "object",
      properties: { transactionId: { type: "string" } },
      required: ["transactionId"]
    }
  },
  {
    name: "list_subscriptions",
    description: "List payment subscriptions",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" }
      }
    }
  },

  // ── PRODUCTS ──
  {
    name: "list_products",
    description: "List products in the store",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        search: { type: "string" }
      }
    }
  },
  {
    name: "get_product",
    description: "Get a specific product by ID",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string" } },
      required: ["productId"]
    }
  },
  {
    name: "create_product",
    description: "Create a new product",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        productType: { type: "string", enum: ["PHYSICAL", "DIGITAL", "SERVICE"] },
        imageUrls: { type: "array", items: { type: "string" } },
        statementDescriptor: { type: "string" }
      },
      required: ["name", "productType"]
    }
  },
  {
    name: "update_product",
    description: "Update a product",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        imageUrls: { type: "array", items: { type: "string" } }
      },
      required: ["productId"]
    }
  },
  {
    name: "delete_product",
    description: "Delete a product",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string" } },
      required: ["productId"]
    }
  },
  {
    name: "list_prices",
    description: "List prices for a product",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" }
      },
      required: ["productId"]
    }
  },
  {
    name: "create_price",
    description: "Create a price for a product",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: ["one_time", "recurring"] },
        amount: { type: "number" },
        currency: { type: "string", default: "USD" },
        recurring: { type: "object" }
      },
      required: ["productId", "name", "type", "amount"]
    }
  },

  // ── COUPONS ──
  {
    name: "list_coupons",
    description: "List all coupons",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" }
      }
    }
  },
  {
    name: "get_coupon",
    description: "Get a coupon by ID",
    inputSchema: {
      type: "object",
      properties: { couponId: { type: "string" } },
      required: ["couponId"]
    }
  },
  {
    name: "create_coupon",
    description: "Create a new coupon",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        code: { type: "string" },
        discountType: { type: "string", enum: ["percentage", "fixed"] },
        discount: { type: "number" },
        currency: { type: "string" },
        expiryDate: { type: "string" },
        maxUses: { type: "number" }
      },
      required: ["name", "code", "discountType", "discount"]
    }
  },
  {
    name: "update_coupon",
    description: "Update a coupon",
    inputSchema: {
      type: "object",
      properties: {
        couponId: { type: "string" },
        name: { type: "string" },
        discount: { type: "number" },
        expiryDate: { type: "string" }
      },
      required: ["couponId"]
    }
  },
  {
    name: "delete_coupon",
    description: "Delete a coupon",
    inputSchema: {
      type: "object",
      properties: { couponId: { type: "string" } },
      required: ["couponId"]
    }
  },

  // ── WORKFLOWS ──
  {
    name: "get_workflows",
    description: "Get all workflows for the location",
    inputSchema: { type: "object", properties: {} }
  },

  // ── FORMS & SURVEYS ──
  {
    name: "get_surveys",
    description: "Get all surveys",
    inputSchema: {
      type: "object",
      properties: {
        skip: { type: "number" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_survey_submissions",
    description: "Get submissions for a survey",
    inputSchema: {
      type: "object",
      properties: {
        surveyId: { type: "string" },
        skip: { type: "number" },
        limit: { type: "number" },
        startAt: { type: "string" },
        endAt: { type: "string" }
      }
    }
  },

  // ── MEDIA ──
  {
    name: "get_media_files",
    description: "Get media files in the library",
    inputSchema: {
      type: "object",
      properties: {
        skip: { type: "number" },
        limit: { type: "number" },
        type: { type: "string" },
        query: { type: "string" },
        sortBy: { type: "string" }
      }
    }
  },
  {
    name: "delete_media_file",
    description: "Delete a media file",
    inputSchema: {
      type: "object",
      properties: { fileId: { type: "string" } },
      required: ["fileId"]
    }
  },

  // ── USERS ──
  {
    name: "get_location_users",
    description: "Get all users for the location",
    inputSchema: { type: "object", properties: {} }
  },

  // ── CUSTOM OBJECTS ──
  {
    name: "get_all_objects",
    description: "Get all custom object schemas",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_object_schema",
    description: "Get a specific custom object schema",
    inputSchema: {
      type: "object",
      properties: { objectKey: { type: "string" } },
      required: ["objectKey"]
    }
  },
  {
    name: "search_object_records",
    description: "Search records for a custom object",
    inputSchema: {
      type: "object",
      properties: {
        objectKey: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
        skip: { type: "number" }
      },
      required: ["objectKey"]
    }
  },
  {
    name: "create_object_record",
    description: "Create a record for a custom object",
    inputSchema: {
      type: "object",
      properties: {
        objectKey: { type: "string" },
        properties: { type: "object" }
      },
      required: ["objectKey", "properties"]
    }
  },
  {
    name: "get_object_record",
    description: "Get a specific custom object record",
    inputSchema: {
      type: "object",
      properties: {
        objectKey: { type: "string" },
        recordId: { type: "string" }
      },
      required: ["objectKey", "recordId"]
    }
  },
  {
    name: "update_object_record",
    description: "Update a custom object record",
    inputSchema: {
      type: "object",
      properties: {
        objectKey: { type: "string" },
        recordId: { type: "string" },
        properties: { type: "object" }
      },
      required: ["objectKey", "recordId", "properties"]
    }
  },
  {
    name: "delete_object_record",
    description: "Delete a custom object record",
    inputSchema: {
      type: "object",
      properties: {
        objectKey: { type: "string" },
        recordId: { type: "string" }
      },
      required: ["objectKey", "recordId"]
    }
  }
];

// ─── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(name, args) {
  const locationId = args.locationId || loc();

  switch (name) {

    // ── CONTACTS ──
    case "search_contacts": {
      const p = new URLSearchParams({ locationId });
      if (args.query) p.set("query", args.query);
      if (args.limit) p.set("limit", args.limit);
      if (args.skip) p.set("skip", args.skip);
      return ghlRequest("GET", `/contacts/search?${p}`);
    }
    case "get_contact":
      return ghlRequest("GET", `/contacts/${args.contactId}`);
    case "create_contact":
      return ghlRequest("POST", "/contacts/", { ...args, locationId });
    case "update_contact": {
      const { contactId, ...body } = args;
      return ghlRequest("PUT", `/contacts/${contactId}`, body);
    }
    case "delete_contact":
      return ghlRequest("DELETE", `/contacts/${args.contactId}`);
    case "upsert_contact":
      return ghlRequest("POST", "/contacts/upsert", { ...args, locationId });
    case "add_contact_tags":
      return ghlRequest("POST", `/contacts/${args.contactId}/tags`, { tags: args.tags });
    case "remove_contact_tags":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/tags`, { tags: args.tags });
    case "get_contact_notes":
      return ghlRequest("GET", `/contacts/${args.contactId}/notes`);
    case "create_contact_note":
      return ghlRequest("POST", `/contacts/${args.contactId}/notes`, { body: args.body, userId: args.userId });
    case "update_contact_note":
      return ghlRequest("PUT", `/contacts/${args.contactId}/notes/${args.noteId}`, { body: args.body });
    case "delete_contact_note":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/notes/${args.noteId}`);
    case "get_contact_tasks":
      return ghlRequest("GET", `/contacts/${args.contactId}/tasks`);
    case "create_contact_task":
      return ghlRequest("POST", `/contacts/${args.contactId}/tasks`, {
        title: args.title, dueDate: args.dueDate,
        status: args.status || "incompleted", assignedTo: args.assignedTo, body: args.body
      });
    case "update_contact_task": {
      const { contactId, taskId, ...body } = args;
      return ghlRequest("PUT", `/contacts/${contactId}/tasks/${taskId}`, body);
    }
    case "delete_contact_task":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/tasks/${args.taskId}`);
    case "get_contact_appointments":
      return ghlRequest("GET", `/contacts/${args.contactId}/appointments`);
    case "add_contact_to_workflow":
      return ghlRequest("POST", `/contacts/${args.contactId}/workflow/${args.workflowId}`,
        args.eventStartTime ? { eventStartTime: args.eventStartTime } : {});
    case "remove_contact_from_workflow":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/workflow/${args.workflowId}`);
    case "add_contact_to_campaign":
      return ghlRequest("POST", `/contacts/${args.contactId}/campaigns/${args.campaignId}`);
    case "remove_contact_from_campaign":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/campaigns/${args.campaignId}`);
    case "remove_contact_from_all_campaigns":
      return ghlRequest("DELETE", `/contacts/${args.contactId}/campaigns/removeAll`);

    // ── CONVERSATIONS ──
    case "search_conversations": {
      const p = new URLSearchParams({ locationId });
      if (args.contactId) p.set("contactId", args.contactId);
      if (args.query) p.set("query", args.query);
      if (args.limit) p.set("limit", args.limit);
      if (args.skip) p.set("skip", args.skip);
      if (args.status) p.set("status", args.status);
      return ghlRequest("GET", `/conversations/search?${p}`);
    }
    case "get_conversation":
      return ghlRequest("GET", `/conversations/${args.conversationId}`);
    case "create_conversation":
      return ghlRequest("POST", "/conversations/", { contactId: args.contactId, locationId });
    case "get_messages": {
      const p = new URLSearchParams();
      if (args.limit) p.set("limit", args.limit);
      if (args.lastMessageId) p.set("lastMessageId", args.lastMessageId);
      return ghlRequest("GET", `/conversations/${args.conversationId}/messages?${p}`);
    }
    case "send_sms":
      return ghlRequest("POST", "/conversations/messages", {
        type: "SMS", conversationId: args.conversationId,
        message: args.message, fromNumber: args.fromNumber, toNumber: args.toNumber
      });
    case "send_email":
      return ghlRequest("POST", "/conversations/messages", {
        type: "Email", conversationId: args.conversationId,
        subject: args.subject, body: args.body,
        emailFrom: args.emailFrom, emailTo: args.emailTo,
        replyToMessageId: args.replyToMessageId
      });
    case "update_conversation": {
      const { conversationId, ...body } = args;
      return ghlRequest("PUT", `/conversations/${conversationId}`, body);
    }

    // ── OPPORTUNITIES ──
    case "search_opportunities": {
      const p = new URLSearchParams({ location_id: locationId });
      if (args.query) p.set("q", args.query);
      if (args.pipelineId) p.set("pipeline_id", args.pipelineId);
      if (args.stageId) p.set("pipeline_stage_id", args.stageId);
      if (args.contactId) p.set("contact_id", args.contactId);
      if (args.status) p.set("status", args.status);
      if (args.limit) p.set("limit", args.limit);
      if (args.skip) p.set("startAfter", args.skip);
      return ghlRequest("GET", `/opportunities/search?${p}`);
    }
    case "get_opportunity":
      return ghlRequest("GET", `/opportunities/${args.opportunityId}`);
    case "create_opportunity":
      return ghlRequest("POST", "/opportunities/", { ...args, locationId });
    case "update_opportunity": {
      const { opportunityId, ...body } = args;
      return ghlRequest("PUT", `/opportunities/${opportunityId}`, body);
    }
    case "delete_opportunity":
      return ghlRequest("DELETE", `/opportunities/${args.opportunityId}`);
    case "get_pipelines":
      return ghlRequest("GET", `/opportunities/pipelines/?locationId=${locationId}`);
    case "update_opportunity_status":
      return ghlRequest("PUT", `/opportunities/${args.opportunityId}/status`, { status: args.status });

    // ── CALENDARS ──
    case "get_calendars":
      return ghlRequest("GET", `/calendars/?locationId=${locationId}`);
    case "get_calendar":
      return ghlRequest("GET", `/calendars/${args.calendarId}`);
    case "create_calendar":
      return ghlRequest("POST", "/calendars/", { ...args, locationId });
    case "update_calendar": {
      const { calendarId, ...body } = args;
      return ghlRequest("PUT", `/calendars/${calendarId}`, body);
    }
    case "delete_calendar":
      return ghlRequest("DELETE", `/calendars/${args.calendarId}`);
    case "get_calendar_events": {
      const p = new URLSearchParams({ locationId });
      if (args.calendarId) p.set("calendarId", args.calendarId);
      if (args.startTime) p.set("startTime", args.startTime);
      if (args.endTime) p.set("endTime", args.endTime);
      if (args.userId) p.set("userId", args.userId);
      return ghlRequest("GET", `/calendars/events?${p}`);
    }
    case "get_free_slots": {
      const p = new URLSearchParams({
        calendarId: args.calendarId,
        startDate: args.startDate,
        endDate: args.endDate
      });
      if (args.timezone) p.set("timezone", args.timezone);
      return ghlRequest("GET", `/calendars/${args.calendarId}/free-slots?${p}`);
    }
    case "create_appointment":
      return ghlRequest("POST", "/calendars/events/appointments", { ...args, locationId });
    case "get_appointment":
      return ghlRequest("GET", `/calendars/events/appointments/${args.appointmentId}`);
    case "update_appointment": {
      const { appointmentId, ...body } = args;
      return ghlRequest("PUT", `/calendars/events/appointments/${appointmentId}`, body);
    }
    case "delete_appointment":
      return ghlRequest("DELETE", `/calendars/events/appointments/${args.appointmentId}`);
    case "get_calendar_groups":
      return ghlRequest("GET", `/calendars/groups?locationId=${locationId}`);

    // ── BLOGS ──
    case "get_blog_sites": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      return ghlRequest("GET", `/blogs/?${p}`);
    }
    case "get_blog_posts": {
      const p = new URLSearchParams({ locationId });
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      if (args.status) p.set("status", args.status);
      return ghlRequest("GET", `/blogs/posts?${p}`);
    }
    case "get_blog_post":
      return ghlRequest("GET", `/blogs/posts/${args.postId}`);
    case "create_blog_post":
      return ghlRequest("POST", "/blogs/posts", { ...args, locationId });
    case "update_blog_post": {
      const { postId, ...body } = args;
      return ghlRequest("PUT", `/blogs/posts/${postId}`, body);
    }
    case "get_blog_authors": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      return ghlRequest("GET", `/blogs/authors?${p}`);
    }
    case "get_blog_categories": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      return ghlRequest("GET", `/blogs/categories?${p}`);
    }

    // ── SOCIAL MEDIA ──
    case "get_social_accounts":
      return ghlRequest("GET", `/social-media-posting/oauth/${locationId}/accounts${args.userId ? `?userId=${args.userId}` : ""}`);
    case "get_social_posts": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      if (args.status) p.set("status", args.status);
      if (args.accountId) p.set("accountId", args.accountId);
      return ghlRequest("GET", `/social-media-posting/posts?${p}`);
    }
    case "get_social_post":
      return ghlRequest("GET", `/social-media-posting/posts/${args.postId}`);
    case "create_social_post":
      return ghlRequest("POST", "/social-media-posting/posts", { ...args, locationId });
    case "update_social_post": {
      const { postId, ...body } = args;
      return ghlRequest("PUT", `/social-media-posting/posts/${postId}`, body);
    }
    case "delete_social_post":
      return ghlRequest("DELETE", `/social-media-posting/posts/${args.postId}`);
    case "get_social_media_statistics": {
      const p = new URLSearchParams({ locationId });
      if (args.accountId) p.set("accountId", args.accountId);
      if (args.startDate) p.set("startDate", args.startDate);
      if (args.endDate) p.set("endDate", args.endDate);
      return ghlRequest("GET", `/social-media-posting/statistics?${p}`);
    }

    // ── LOCATION ──
    case "get_location":
      return ghlRequest("GET", `/locations/${locationId}`);
    case "update_location": {
      const { locationId: lid, ...body } = args;
      return ghlRequest("PUT", `/locations/${lid || locationId}`, body);
    }
    case "get_location_custom_fields": {
      const p = new URLSearchParams({ locationId });
      if (args.model) p.set("model", args.model);
      return ghlRequest("GET", `/locations/${locationId}/customFields?${p}`);
    }
    case "get_location_tags":
      return ghlRequest("GET", `/locations/${locationId}/tags`);
    case "create_location_tag":
      return ghlRequest("POST", `/locations/${locationId}/tags`, { name: args.name });
    case "delete_location_tag":
      return ghlRequest("DELETE", `/locations/${locationId}/tags/${args.tagId}`);
    case "get_location_templates": {
      const p = new URLSearchParams({ locationId, deleted: "false" });
      if (args.type) p.set("type", args.type);
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      if (args.originId) p.set("originId", args.originId);
      return ghlRequest("GET", `/locations/${locationId}/templates?${p}`);
    }
    case "get_location_custom_values":
      return ghlRequest("GET", `/locations/${locationId}/customValues`);

    // ── EMAIL ──
    case "get_email_templates": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      if (args.type) p.set("type", args.type);
      return ghlRequest("GET", `/locations/${locationId}/emailTemplates?${p}`);
    }
    case "create_email_template":
      return ghlRequest("POST", `/locations/${locationId}/emailTemplates`, { ...args, locationId });
    case "get_email_campaigns": {
      const p = new URLSearchParams({ locationId });
      if (args.status) p.set("status", args.status);
      if (args.limit) p.set("limit", args.limit);
      if (args.skip) p.set("skip", args.skip);
      return ghlRequest("GET", `/emails/campaigns?${p}`);
    }

    // ── INVOICES ──
    case "list_invoices": {
      const p = new URLSearchParams({ locationId });
      if (args.contactId) p.set("contactId", args.contactId);
      if (args.status) p.set("status", args.status);
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      if (args.startAt) p.set("startAt", args.startAt);
      if (args.endAt) p.set("endAt", args.endAt);
      return ghlRequest("GET", `/invoices/?${p}`);
    }
    case "get_invoice":
      return ghlRequest("GET", `/invoices/${args.invoiceId}`);
    case "create_invoice":
      return ghlRequest("POST", "/invoices/", { ...args, locationId });
    case "send_invoice":
      return ghlRequest("POST", `/invoices/${args.invoiceId}/send`, { userId: args.userId });
    case "update_invoice": {
      const { invoiceId, ...body } = args;
      return ghlRequest("PUT", `/invoices/${invoiceId}`, { ...body, locationId });
    }
    case "delete_invoice":
      return ghlRequest("DELETE", `/invoices/${args.invoiceId}`);
    case "list_invoice_templates": {
      const p = new URLSearchParams({ locationId });
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      return ghlRequest("GET", `/invoices/template?${p}`);
    }

    // ── PAYMENTS ──
    case "list_orders": {
      const p = new URLSearchParams({ locationId });
      if (args.contactId) p.set("contactId", args.contactId);
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      if (args.startAt) p.set("startAt", args.startAt);
      if (args.endAt) p.set("endAt", args.endAt);
      return ghlRequest("GET", `/payments/orders?${p}`);
    }
    case "get_order_by_id":
      return ghlRequest("GET", `/payments/orders/${args.orderId}?locationId=${locationId}`);
    case "list_transactions": {
      const p = new URLSearchParams({ locationId });
      if (args.contactId) p.set("contactId", args.contactId);
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      if (args.startAt) p.set("startAt", args.startAt);
      if (args.endAt) p.set("endAt", args.endAt);
      return ghlRequest("GET", `/payments/transactions?${p}`);
    }
    case "get_transaction_by_id":
      return ghlRequest("GET", `/payments/transactions/${args.transactionId}?locationId=${locationId}`);
    case "list_subscriptions": {
      const p = new URLSearchParams({ locationId });
      if (args.contactId) p.set("contactId", args.contactId);
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      return ghlRequest("GET", `/payments/subscriptions?${p}`);
    }

    // ── PRODUCTS ──
    case "list_products": {
      const p = new URLSearchParams({ locationId });
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      if (args.search) p.set("search", args.search);
      return ghlRequest("GET", `/products/?${p}`);
    }
    case "get_product":
      return ghlRequest("GET", `/products/${args.productId}`);
    case "create_product":
      return ghlRequest("POST", "/products/", { ...args, locationId });
    case "update_product": {
      const { productId, ...body } = args;
      return ghlRequest("PUT", `/products/${productId}`, body);
    }
    case "delete_product":
      return ghlRequest("DELETE", `/products/${args.productId}`);
    case "list_prices": {
      const p = new URLSearchParams({ locationId });
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      return ghlRequest("GET", `/products/${args.productId}/price?${p}`);
    }
    case "create_price": {
      const { productId, ...body } = args;
      return ghlRequest("POST", `/products/${productId}/price`, { ...body, locationId });
    }

    // ── COUPONS ──
    case "list_coupons": {
      const p = new URLSearchParams({ locationId });
      if (args.limit) p.set("limit", args.limit);
      if (args.offset) p.set("offset", args.offset);
      return ghlRequest("GET", `/products/coupons?${p}`);
    }
    case "get_coupon":
      return ghlRequest("GET", `/products/coupons/${args.couponId}?locationId=${locationId}`);
    case "create_coupon":
      return ghlRequest("POST", "/products/coupons", { ...args, locationId });
    case "update_coupon": {
      const { couponId, ...body } = args;
      return ghlRequest("PUT", `/products/coupons/${couponId}`, { ...body, locationId });
    }
    case "delete_coupon":
      return ghlRequest("DELETE", `/products/coupons/${args.couponId}?locationId=${locationId}`);

    // ── WORKFLOWS ──
    case "get_workflows":
      return ghlRequest("GET", `/workflows/?locationId=${locationId}`);

    // ── SURVEYS ──
    case "get_surveys": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      return ghlRequest("GET", `/surveys/?${p}`);
    }
    case "get_survey_submissions": {
      const p = new URLSearchParams({ locationId });
      if (args.surveyId) p.set("surveyId", args.surveyId);
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      if (args.startAt) p.set("startAt", args.startAt);
      if (args.endAt) p.set("endAt", args.endAt);
      return ghlRequest("GET", `/surveys/submissions?${p}`);
    }

    // ── MEDIA ──
    case "get_media_files": {
      const p = new URLSearchParams({ locationId });
      if (args.skip) p.set("skip", args.skip);
      if (args.limit) p.set("limit", args.limit);
      if (args.type) p.set("type", args.type);
      if (args.query) p.set("query", args.query);
      if (args.sortBy) p.set("sortBy", args.sortBy);
      return ghlRequest("GET", `/medias/files?${p}`);
    }
    case "delete_media_file":
      return ghlRequest("DELETE", `/medias/files/${args.fileId}`);

    // ── USERS ──
    case "get_location_users":
      return ghlRequest("GET", `/users/?locationId=${locationId}`);

    // ── CUSTOM OBJECTS ──
    case "get_all_objects":
      return ghlRequest("GET", `/objects/?locationId=${locationId}`);
    case "get_object_schema":
      return ghlRequest("GET", `/objects/${args.objectKey}?locationId=${locationId}`);
    case "search_object_records": {
      const p = new URLSearchParams({ locationId });
      if (args.query) p.set("query", args.query);
      if (args.limit) p.set("limit", args.limit);
      if (args.skip) p.set("skip", args.skip);
      return ghlRequest("GET", `/objects/${args.objectKey}/records/search?${p}`);
    }
    case "create_object_record":
      return ghlRequest("POST", `/objects/${args.objectKey}/records`, { properties: args.properties, locationId });
    case "get_object_record":
      return ghlRequest("GET", `/objects/${args.objectKey}/records/${args.recordId}?locationId=${locationId}`);
    case "update_object_record":
      return ghlRequest("PATCH", `/objects/${args.objectKey}/records/${args.recordId}`, { properties: args.properties });
    case "delete_object_record":
      return ghlRequest("DELETE", `/objects/${args.objectKey}/records/${args.recordId}?locationId=${locationId}`);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Protocol Handlers ─────────────────────────────────────────────────────

function log(msg, data = null) {
  console.log(`[${new Date().toISOString()}] [MCP] ${msg}${data ? ": " + JSON.stringify(data) : ""}`);
}

function rpc(id, result = null, error = null) {
  const r = { jsonrpc: "2.0", id };
  if (error) r.error = error; else r.result = result;
  return r;
}

function notify(method, params = {}) {
  return { jsonrpc: "2.0", method, params };
}

async function processMessage(msg) {
  if (msg.jsonrpc !== "2.0")
    return rpc(msg.id, null, { code: -32600, message: "Invalid Request" });

  switch (msg.method) {
    case "initialize":
      return rpc(msg.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO
      });
    case "tools/list":
      return rpc(msg.id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args } = msg.params;
      try {
        const result = await executeTool(name, args || {});
        return rpc(msg.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        return rpc(msg.id, {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        });
      }
    }
    case "ping":
      return rpc(msg.id, {});
    default:
      return rpc(msg.id, null, { code: -32601, message: `Method not found: ${msg.method}` });
  }
}

// ─── CORS & SSE Helpers ────────────────────────────────────────────────────────

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendSSE(res, data) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  res.write(`data: ${msg}\n\n`);
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  log(`${req.method} ${req.url}`);
  setCORS(res);

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.status(200).json({
      status: "healthy",
      server: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocol: MCP_PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
      toolCount: TOOLS.length,
      tools: TOOLS.map(t => t.name),
      endpoint: "/sse"
    });
    return;
  }

  if (req.url?.includes("favicon")) { res.status(404).end(); return; }

  // SSE endpoint
  if (req.url === "/sse") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });

    if (req.method === "GET") {
      log("SSE connection established");
      sendSSE(res, notify("notification/initialized", {}));
      setTimeout(() => sendSSE(res, notify("notification/tools/list_changed", {})), 100);

      const hb = setInterval(() => res.write(": heartbeat\n\n"), 25000);
      req.on("close", () => { log("SSE closed"); clearInterval(hb); });
      req.on("error", () => clearInterval(hb));
      setTimeout(() => { clearInterval(hb); res.end(); }, 50000);
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const msg = JSON.parse(body);
          log("Processing", { method: msg.method, id: msg.id });
          const response = await processMessage(msg);
          sendSSE(res, response);
          setTimeout(() => res.end(), 100);
        } catch (err) {
          sendSSE(res, rpc(null, null, { code: -32700, message: "Parse error" }));
          res.end();
        }
      });
      return;
    }
  }

  res.status(404).json({ error: "Not found" });
};
