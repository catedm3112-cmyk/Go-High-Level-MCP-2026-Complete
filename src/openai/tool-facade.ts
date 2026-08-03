import { createHash } from 'crypto';

export interface ToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface OpenAIFacadeOptions {
  locationId: string;
  publicBaseUrl: string;
  now?: () => number;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
}

export interface FetchResult {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowActionInput {
  type: string;
  name: string;
  attributes?: Record<string, unknown>;
  id?: string;
  next?: string[];
  parentKey?: string;
  cat?: string;
  nodeType?: string;
}

export interface WorkflowTriggerInput {
  type: string;
  name?: string;
  data?: Record<string, unknown>;
}

export interface CreateWorkflowDraftInput {
  name: string;
  trigger?: WorkflowTriggerInput;
  actions?: WorkflowActionInput[];
}

export interface SendCommunicationInput {
  channel: 'sms' | 'email';
  contactId: string;
  message: string;
  subject?: string;
  html?: string;
  fromNumber?: string;
  emailFrom?: string;
  previewOnly?: boolean;
  confirmation?: 'SEND';
  idempotencyKey?: string;
}

type SafeCallResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

type IdempotencyEntry = {
  fingerprint: string;
  result: unknown;
  createdAt: number;
};

const MAX_RESULT_ITEMS = 25;
const MAX_STRING_LENGTH = 2_000;
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1_000;

/**
 * A deliberately small, OpenAI-facing facade over the broad Claude-era tool
 * registry. The facade owns routing, bounded responses, and write safeguards.
 */
export class OpenAIGHLFacade {
  private readonly now: () => number;
  private readonly idempotency = new Map<string, IdempotencyEntry>();

  constructor(
    private readonly tools: ToolCaller,
    private readonly options: OpenAIFacadeOptions
  ) {
    this.now = options.now ?? Date.now;
  }

  async search(query: string): Promise<{ results: SearchResult[] }> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return { results: [] };

    if (/\b(audit|health|configuration|settings|account)\b/.test(normalizedQuery)) {
      return {
        results: [{
          id: 'audit:account',
          title: 'Current GHL account audit',
          url: this.resourceUrl('audit', 'account'),
        }],
      };
    }

    const wantsWorkflows = /\b(workflow|automation|trigger|campaign)\b/.test(normalizedQuery);
    const wantsCommunications = /\b(message|sms|email|conversation|communication|reply|inbox)\b/.test(normalizedQuery);
    const wantsContacts = /\b(contact|lead|customer|person)\b/.test(normalizedQuery);
    const broadSearch = !wantsWorkflows && !wantsCommunications && !wantsContacts;

    const tasks: Promise<SearchResult[]>[] = [];
    if (wantsWorkflows || broadSearch) tasks.push(this.searchWorkflows(normalizedQuery));
    if (wantsContacts || wantsCommunications || broadSearch) tasks.push(this.searchContacts(query));
    if (wantsCommunications || broadSearch) tasks.push(this.searchConversations(query));

    const groups = await Promise.all(tasks);
    const deduped = new Map<string, SearchResult>();
    for (const result of groups.flat()) {
      if (!deduped.has(result.id)) deduped.set(result.id, result);
      if (deduped.size >= MAX_RESULT_ITEMS) break;
    }

    return { results: [...deduped.values()] };
  }

  async fetch(id: string): Promise<FetchResult> {
    const separator = id.indexOf(':');
    if (separator < 1 || separator === id.length - 1) {
      throw new Error('Resource ID must use the form "type:id".');
    }

    const kind = id.slice(0, separator);
    const resourceId = id.slice(separator + 1);
    let title: string;
    let data: unknown;

    switch (kind) {
      case 'audit':
        title = 'Current GHL account audit';
        data = await this.auditAccount('all');
        break;
      case 'workflow': {
        title = `Workflow ${resourceId}`;
        const full = await this.safeCall('ghl_get_workflow_full', { workflowId: resourceId });
        data = full.ok
          ? full.data
          : await this.callRequired('ghl_get_workflow', { workflowId: resourceId });
        title = this.titleFrom(data, title);
        break;
      }
      case 'contact':
        data = await this.callRequired('get_contact', { contactId: resourceId });
        title = this.contactTitle(this.firstRecord(data), `Contact ${resourceId}`);
        break;
      case 'conversation':
        data = await this.callRequired('get_conversation', {
          conversationId: resourceId,
          limit: 25,
        });
        title = this.conversationTitle(this.firstRecord(data), `Conversation ${resourceId}`);
        break;
      default:
        throw new Error(`Unsupported resource type: ${kind}`);
    }

    const bounded = boundValue(data);
    return {
      id,
      title,
      text: JSON.stringify(bounded),
      url: this.resourceUrl(kind, resourceId),
      metadata: { type: kind, locationId: this.options.locationId },
    };
  }

  async auditAccount(
    scope: 'all' | 'configuration' | 'workflows' | 'communications' = 'all'
  ): Promise<Record<string, unknown>> {
    const includeConfiguration = scope === 'all' || scope === 'configuration';
    const includeWorkflows = scope === 'all' || scope === 'workflows';
    const includeCommunications = scope === 'all' || scope === 'communications';

    const calls: Record<string, Promise<SafeCallResult>> = {};

    if (includeConfiguration) {
      calls.location = this.safeCall('get_location', { locationId: this.options.locationId });
      calls.calendars = this.safeCall('get_calendars', { showDrafted: true });
      calls.customFields = this.safeCall('get_location_custom_fields', {
        locationId: this.options.locationId,
        model: 'all',
      });
      calls.tags = this.safeCall('get_location_tags', { locationId: this.options.locationId });
    }

    if (includeWorkflows) {
      calls.workflows = this.safeCall('ghl_list_workflows', { limit: 100, skip: 0 });
    }

    if (includeCommunications) {
      calls.conversations = this.safeCall('search_conversations', {
        status: 'all',
        limit: 50,
      });
      calls.unreadConversations = this.safeCall('search_conversations', {
        status: 'unread',
        limit: 50,
      });
    }

    const entries = await Promise.all(
      Object.entries(calls).map(async ([key, promise]) => [key, await promise] as const)
    );
    const results = Object.fromEntries(entries) as Record<string, SafeCallResult>;
    const findings: Array<Record<string, unknown>> = [];
    let score = 100;

    const addFinding = (
      severity: 'high' | 'medium' | 'low',
      area: string,
      message: string,
      recommendation: string,
      deduction: number
    ) => {
      findings.push({ severity, area, message, recommendation });
      score = Math.max(0, score - deduction);
    };

    for (const [area, result] of entries) {
      if (!result.ok) {
        addFinding(
          'medium',
          area,
          result.error || `${area} could not be inspected.`,
          'Verify the GHL token scopes and location permissions for this resource.',
          8
        );
      }
    }

    const location = this.firstRecord(results.location?.data);
    if (includeConfiguration && location) {
      for (const [field, label] of [
        ['timezone', 'timezone'],
        ['phone', 'business phone'],
        ['website', 'website'],
        ['address', 'business address'],
      ] as const) {
        if (!location[field]) {
          addFinding(
            field === 'timezone' ? 'high' : 'low',
            'configuration',
            `The location is missing a ${label}.`,
            `Set the ${label} in the GHL location settings.`,
            field === 'timezone' ? 12 : 3
          );
        }
      }
    }

    const workflows = findArray(results.workflows?.data, ['workflows', 'results', 'data']);
    if (includeWorkflows && results.workflows?.ok) {
      if (workflows.length === 0) {
        addFinding(
          'high',
          'workflows',
          'No workflows were returned for this location.',
          'Create at least one draft workflow and validate its trigger before publishing.',
          20
        );
      } else {
        const drafts = workflows.filter(item =>
          /draft/i.test(String(record(item).status ?? ''))
        ).length;
        const inactive = workflows.filter(item =>
          /inactive|paused/i.test(String(record(item).status ?? ''))
        ).length;
        if (drafts > 0) {
          addFinding(
            'low',
            'workflows',
            `${drafts} workflow(s) are still drafts.`,
            'Review draft workflows and either publish or archive them.',
            Math.min(8, drafts)
          );
        }
        if (inactive > 0) {
          addFinding(
            'medium',
            'workflows',
            `${inactive} workflow(s) are inactive or paused.`,
            'Confirm whether paused workflows are intentional and document their owners.',
            Math.min(12, inactive * 2)
          );
        }
      }
    }

    const calendars = findArray(results.calendars?.data, ['calendars', 'results', 'data']);
    if (includeConfiguration && results.calendars?.ok && calendars.length === 0) {
      addFinding(
        'medium',
        'configuration',
        'No calendars were returned.',
        'Configure a calendar if appointment-based workflows or reminders are expected.',
        7
      );
    }

    const fields = findArray(results.customFields?.data, ['customFields', 'fields', 'data']);
    const tags = findArray(results.tags?.data, ['tags', 'results', 'data']);
    const conversations = findArray(results.conversations?.data, ['conversations', 'results', 'data']);
    const unread = findArray(results.unreadConversations?.data, ['conversations', 'results', 'data']);

    if (includeCommunications && results.unreadConversations?.ok && unread.length >= 10) {
      addFinding(
        'medium',
        'communications',
        `${unread.length} unread conversations were returned in the audit sample.`,
        'Review inbox assignment and response-time automations.',
        10
      );
    }

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    return boundValue({
      scope,
      locationId: this.options.locationId,
      generatedAt: new Date(this.now()).toISOString(),
      score,
      grade,
      metrics: {
        workflows: workflows.length,
        calendars: calendars.length,
        customFields: fields.length,
        tags: tags.length,
        conversationSample: conversations.length,
        unreadConversationSample: unread.length,
      },
      findings: findings.sort((a, b) =>
        severityRank(String(a.severity)) - severityRank(String(b.severity))
      ),
      partial: entries.some(([, result]) => !result.ok),
    }) as Record<string, unknown>;
  }

  async createWorkflowDraft(input: CreateWorkflowDraftInput): Promise<Record<string, unknown>> {
    const name = input.name.trim();
    if (!name) throw new Error('Workflow name is required.');
    if (name.length > 120) throw new Error('Workflow name must be 120 characters or fewer.');
    if ((input.actions?.length ?? 0) > 50) {
      throw new Error('A workflow draft can contain at most 50 actions per call.');
    }

    const result = await this.callRequired('ghl_create_workflow', {
      name,
      trigger: input.trigger,
      actions: input.actions ?? [],
      publish: false,
    });

    return boundValue({
      created: true,
      status: 'draft',
      message: 'Workflow draft created. Inspect it before publishing.',
      result,
    }) as Record<string, unknown>;
  }

  async sendCommunication(input: SendCommunicationInput): Promise<Record<string, unknown>> {
    const previewOnly = input.previewOnly !== false;
    const preview = {
      channel: input.channel,
      contactId: input.contactId,
      subject: input.subject,
      message: input.message,
      html: input.html,
      fromNumber: input.fromNumber,
      emailFrom: input.emailFrom,
    };

    if (input.channel === 'email' && !input.subject?.trim()) {
      throw new Error('Email communications require a subject.');
    }

    if (previewOnly) {
      return {
        sent: false,
        previewOnly: true,
        preview: boundValue(preview),
        nextStep:
          'Review the preview, then call again with previewOnly=false, confirmation="SEND", and an idempotencyKey.',
      };
    }

    if (input.confirmation !== 'SEND') {
      throw new Error('Sending requires confirmation="SEND".');
    }
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Sending requires a non-empty idempotencyKey.');
    }

    this.pruneIdempotencyEntries();
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(preview))
      .digest('hex');
    const prior = this.idempotency.get(input.idempotencyKey);

    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new Error('The idempotencyKey was already used for a different communication.');
      }
      return {
        sent: true,
        deduplicated: true,
        result: boundValue(prior.result),
      };
    }

    const toolName = input.channel === 'sms' ? 'send_sms' : 'send_email';
    const args = input.channel === 'sms'
      ? {
          contactId: input.contactId,
          message: input.message,
          fromNumber: input.fromNumber,
        }
      : {
          contactId: input.contactId,
          subject: input.subject,
          message: input.message,
          html: input.html,
          emailFrom: input.emailFrom,
        };

    const result = await this.callRequired(toolName, args);
    this.idempotency.set(input.idempotencyKey, {
      fingerprint,
      result,
      createdAt: this.now(),
    });

    return {
      sent: true,
      deduplicated: false,
      result: boundValue(result),
    };
  }

  private async searchWorkflows(query: string): Promise<SearchResult[]> {
    const response = await this.safeCall('ghl_list_workflows', { limit: 50, skip: 0 });
    if (!response.ok) return [];

    return findArray(response.data, ['workflows', 'results', 'data'])
      .map(record)
      .filter(item => {
        const title = String(item.name ?? item.title ?? '');
        return !query || title.toLowerCase().includes(query) || query.includes('workflow');
      })
      .slice(0, 15)
      .map(item => {
        const id = this.itemId(item);
        return id
          ? {
              id: `workflow:${id}`,
              title: String(item.name ?? `Workflow ${id}`),
              url: this.resourceUrl('workflow', id),
            }
          : null;
      })
      .filter((item): item is SearchResult => item !== null);
  }

  private async searchContacts(query: string): Promise<SearchResult[]> {
    const response = await this.safeCall('search_contacts', { query, limit: 15 });
    if (!response.ok) return [];

    return findArray(response.data, ['contacts', 'results', 'data'])
      .map(record)
      .slice(0, 15)
      .map(item => {
        const id = this.itemId(item);
        return id
          ? {
              id: `contact:${id}`,
              title: this.contactTitle(item, `Contact ${id}`),
              url: this.resourceUrl('contact', id),
            }
          : null;
      })
      .filter((item): item is SearchResult => item !== null);
  }

  private async searchConversations(query: string): Promise<SearchResult[]> {
    const response = await this.safeCall('search_conversations', {
      query,
      status: 'all',
      limit: 15,
    });
    if (!response.ok) return [];

    return findArray(response.data, ['conversations', 'results', 'data'])
      .map(record)
      .slice(0, 15)
      .map(item => {
        const id = this.itemId(item);
        return id
          ? {
              id: `conversation:${id}`,
              title: this.conversationTitle(item, `Conversation ${id}`),
              url: this.resourceUrl('conversation', id),
            }
          : null;
      })
      .filter((item): item is SearchResult => item !== null);
  }

  private async safeCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<SafeCallResult> {
    try {
      const raw = await this.tools.callTool(name, args);
      if (raw === undefined) {
        return { ok: false, error: `Underlying tool "${name}" is unavailable.` };
      }
      const data = unwrapToolResult(raw);
      if (isErrorResult(raw)) {
        return {
          ok: false,
          error: extractErrorMessage(data) || `Underlying tool "${name}" failed.`,
        };
      }
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async callRequired(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.safeCall(name, args);
    if (!result.ok) throw new Error(result.error || `Tool "${name}" failed.`);
    return result.data;
  }

  private resourceUrl(kind: string, id: string): string {
    const base = this.options.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/openai/resources/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
  }

  private itemId(item: Record<string, unknown>): string | undefined {
    const value = item._id ?? item.id ?? item.workflowId ?? item.contactId ?? item.conversationId;
    return value === undefined || value === null ? undefined : String(value);
  }

  private titleFrom(value: unknown, fallback: string): string {
    const item = this.firstRecord(value);
    return String(item.name ?? item.title ?? fallback);
  }

  private contactTitle(item: Record<string, unknown>, fallback: string): string {
    const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
    return fullName || String(item.name ?? item.email ?? item.phone ?? fallback);
  }

  private conversationTitle(item: Record<string, unknown>, fallback: string): string {
    return String(
      item.contactName ??
      item.fullName ??
      item.name ??
      item.email ??
      item.phone ??
      item.lastMessage ??
      fallback
    );
  }

  private firstRecord(value: unknown): Record<string, unknown> {
    const unwrapped = unwrapToolResult(value);
    if (Array.isArray(unwrapped)) return record(unwrapped[0]);
    if (unwrapped && typeof unwrapped === 'object') {
      const object = record(unwrapped);
      for (const key of ['location', 'contact', 'conversation', 'workflow', 'data', 'result']) {
        const nested = object[key];
        if (nested && !Array.isArray(nested) && typeof nested === 'object') return record(nested);
      }
      return object;
    }
    return {};
  }

  private pruneIdempotencyEntries(): void {
    const cutoff = this.now() - IDEMPOTENCY_TTL_MS;
    for (const [key, entry] of this.idempotency) {
      if (entry.createdAt < cutoff) this.idempotency.delete(key);
    }
  }
}

export function unwrapToolResult(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const object = value as Record<string, unknown>;

  if (Array.isArray(object.content)) {
    const textItem = object.content.find(item =>
      Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text')
    ) as Record<string, unknown> | undefined;
    if (typeof textItem?.text === 'string') {
      try {
        return unwrapToolResult(JSON.parse(textItem.text));
      } catch {
        return textItem.text;
      }
    }
  }

  if ('result' in object && Object.keys(object).length === 1) {
    return unwrapToolResult(object.result);
  }

  return value;
}

function isErrorResult(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).isError === true
  );
}

function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const object = value as Record<string, unknown>;
  const candidate = object.error ?? object.message;
  return typeof candidate === 'string' ? candidate : undefined;
}

function findArray(value: unknown, preferredKeys: string[]): unknown[] {
  const unwrapped = unwrapToolResult(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (!unwrapped || typeof unwrapped !== 'object') return [];

  const object = unwrapped as Record<string, unknown>;
  for (const key of preferredKeys) {
    const candidate = object[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = findArray(candidate, preferredKeys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function severityRank(severity: string): number {
  if (severity === 'high') return 0;
  if (severity === 'medium') return 1;
  return 2;
}

function boundValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth limit]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_RESULT_ITEMS).map(item => boundValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/token|authorization|secret|password/i.test(key))
        .map(([key, item]) => [key, boundValue(item, depth + 1)])
    );
  }
  return value;
}
