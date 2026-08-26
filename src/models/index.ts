/**
 * Data models for the Barndoor SDK.
 *
 * This module defines the data models used for API requests and responses,
 * providing type safety and validation that mirrors the Python SDK's Pydantic models.
 */

/**
 * Connection status for MCP servers.
 */
export type ConnectionStatus = 'available' | 'pending' | 'connected';

/**
 * Raw server data from API responses.
 */
export interface ServerSummaryData {
  /** Unique identifier (UUID) for the server */
  id: string;
  /** Human-readable name of the server */
  name: string;
  /** URL-friendly identifier used in API paths */
  slug: string;
  /** Third-party provider name (e.g., "github", "slack") */
  provider?: string | null;
  /** Current connection status */
  connection_status: ConnectionStatus;
}

/**
 * Summary information about an MCP server.
 *
 * Represents basic server information as returned by the list servers
 * endpoint. This is a lightweight representation suitable for listing
 * many servers at once.
 */
export class ServerSummary {
  /** Unique identifier (UUID) for the server */
  public readonly id: string;
  /** Human-readable name of the server */
  public readonly name: string;
  /** URL-friendly identifier used in API paths */
  public readonly slug: string;
  /** Third-party provider name (e.g., "github", "slack") */
  public readonly provider: string | null;
  /** Current connection status */
  public readonly connection_status: ConnectionStatus;

  /**
   * Create a new ServerSummary instance.
   * @param data - Server data from API response
   */
  constructor(data: ServerSummaryData) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.provider = data.provider ?? null;
    this.connection_status = data.connection_status;

    // Validate required fields
    if (!this.id || !this.name || !this.slug || !this.connection_status) {
      throw new Error('ServerSummary missing required fields');
    }
  }

  /**
   * Create a ServerSummary from API response data.
   * @param data - Raw API response data
   * @returns ServerSummary instance
   */
  public static fromApiResponse(data: unknown): ServerSummary {
    return new ServerSummary(data as ServerSummaryData);
  }
}

/**
 * Raw server detail data from API responses.
 */
export interface ServerDetailData extends ServerSummaryData {
  /** MCP base URL from the server directory */
  url?: string | null;
}

/**
 * Detailed information about an MCP server.
 *
 * Extends ServerSummary with additional fields returned when fetching
 * a single server's details.
 */
export class ServerDetail extends ServerSummary {
  /** MCP base URL from the server directory */
  public readonly url: string | null;

  /**
   * Create a new ServerDetail instance.
   * @param data - Server data from API response
   */
  constructor(data: ServerDetailData) {
    super(data);
    this.url = data.url ?? null;
  }

  /**
   * Create a ServerDetail from API response data.
   * @param data - Raw API response data
   * @returns ServerDetail instance
   */
  public static override fromApiResponse(data: unknown): ServerDetail {
    return new ServerDetail(data as ServerDetailData);
  }
}

/**
 * Raw agent token data from API responses.
 */
export interface AgentTokenData {
  /** The agent access token to use for agent operations */
  agent_token: string;
  /** Token lifetime in seconds */
  expires_in: number;
}

/**
 * Response from the agent token exchange endpoint.
 *
 * Contains the agent access token and expiration information returned
 * when exchanging client credentials.
 */
export class AgentToken {
  /** The agent access token to use for agent operations */
  public readonly agent_token: string;
  /** Token lifetime in seconds */
  public readonly expires_in: number;

  /**
   * Create a new AgentToken instance.
   * @param data - Token data from API response
   */
  constructor(data: AgentTokenData) {
    this.agent_token = data.agent_token;
    this.expires_in = data.expires_in;

    // Validate required fields
    if (!this.agent_token || typeof this.expires_in !== 'number') {
      throw new Error('AgentToken missing required fields');
    }
  }

  /**
   * Create an AgentToken from API response data.
   * @param data - Raw API response data
   * @returns AgentToken instance
   */
  public static fromApiResponse(data: unknown): AgentToken {
    return new AgentToken(data as AgentTokenData);
  }
}

// ---------------------------------------------------------------------------
// Notification channels (BCP-3758)
//
// Mirrors the platform's public channel-management surface at
// /api/notification/public/v1/channels. Plain interfaces rather than the
// validating classes above: these are response shapes, not objects with
// behaviour, and interfaces give full compile-time typing at zero runtime cost.
// ---------------------------------------------------------------------------

/**
 * What kind of destination a channel delivers to.
 *
 * `in_app` and `user_email` are personal (owned by one user, always the caller);
 * `email`, `webhook`, `slack` and `teams` are organization-wide.
 */
export type ChannelType = 'in_app' | 'user_email' | 'email' | 'webhook' | 'slack' | 'teams';

/** One alert type a channel is subscribed to. */
export interface ChannelSubscription {
  /**
   * The alert type delivered to the channel (e.g. `break_glass_used`). Read the live
   * vocabulary from `getChannelOptions()` rather than hardcoding it — the set grows
   * over time and is gated per organization.
   */
  alert_type: string;
}

/**
 * A notification delivery destination.
 *
 * Only the destination field belonging to `type` is populated; the rest are null.
 * Secrets are never returned — a webhook's signing secret and a Teams workflow URL
 * surface only as the `has_signing_secret` / `has_workflow_url` flags.
 */
export interface Channel {
  /** Server-assigned channel id. */
  id: string;
  type: ChannelType;
  /** Whether the channel currently delivers. */
  enabled: boolean;
  /** Owning user for a personal channel; null for organization-wide types. */
  user_id: string | null;
  /** Destination for `type: 'email'`. */
  email_address: string | null;
  /** Destination for `type: 'webhook'`. */
  url: string | null;
  /** Human-readable name, set for `slack` and `teams`. */
  label: string | null;
  /** Slack channel id for `type: 'slack'`. */
  slack_channel_id: string | null;
  /** Alert types this channel delivers. Empty means it delivers nothing. */
  subscriptions: ChannelSubscription[];
  created_at?: string;
  updated_at?: string;
  /** Whether a webhook channel has a stored signing secret (never readable back). */
  has_signing_secret: boolean;
  /** Whether a teams channel has a stored Workflows URL (itself a secret). */
  has_workflow_url: boolean;
  /**
   * One-time reveal of a newly generated webhook signing secret. Present ONLY on the
   * response that created it, and null on every later read — store it when you receive
   * it, or rotate with `regenerateChannelSecret()`.
   */
  signing_secret?: string | null;
}

/** Response envelope for the channel list endpoints. */
export interface ChannelListResponse {
  data: Channel[];
}

/** One subscribable alert type, with its intrinsic category and severity. */
export interface AlertTypeOption {
  /** What to send as a subscription's `alert_type`. */
  value: string;
  label: string;
  /** Intrinsic to the type, not configurable. */
  category: string;
  /** Intrinsic to the type, not configurable. */
  severity: string;
}

/** An enum value paired with its display label. */
export interface LabeledOption {
  value: string;
  label: string;
}

/**
 * The subscription vocabulary a channel's `subscriptions` may draw from.
 *
 * `alertTypes` is filtered to what the caller's organization is admitted to —
 * subscribing to a type absent here is accepted but never delivers.
 */
export interface ChannelOptions {
  alert_types: AlertTypeOption[];
  /** The full category vocabulary, unfiltered. */
  categories: LabeledOption[];
  /** The full severity vocabulary, unfiltered. */
  severities: LabeledOption[];
}

/**
 * Result of sending a connectivity-test message through a channel.
 *
 * A transport failure is reported here as `ok: false` with a reason, not as a thrown
 * error: the request to test succeeded, the delivery is what failed.
 */
export interface ChannelTestResult {
  ok: boolean;
  error?: string | null;
}

/** The one-time reveal of a webhook channel's signing secret. */
export interface WebhookSecret {
  /**
   * Standard Webhooks secret (`whsec_` + base64), shown exactly once. Rotating
   * invalidates the previous secret immediately, so deploy this value before the next
   * alert fires.
   */
  signing_secret: string;
}

/** Arguments for {@link BarndoorSDK.upsertChannel}. */
export interface UpsertChannelInput {
  type: ChannelType;
  /**
   * Existing channel to edit authoritatively. Omit to create-or-dedup on the type's
   * natural identity.
   */
  channelId?: string;
  /** Defaults to true. `false` suspends delivery without deleting the channel. */
  enabled?: boolean;
  /** Required for `type: 'email'`. */
  emailAddress?: string;
  /** Required for `type: 'webhook'`. Must be https and resolve to a public address. */
  url?: string;
  /** Required for `slack` and `teams`. */
  label?: string;
  /** Required for `type: 'slack'` — the channel id, not its name. */
  slackChannelId?: string;
  /**
   * Required on create for `type: 'teams'`. Write-only: never returned by any endpoint.
   */
  teamsWorkflowUrl?: string;
  /**
   * The complete set of alert types to deliver. **Replaces** the channel's existing
   * set — omitting it unsubscribes the channel from everything.
   */
  subscriptions?: string[];
}
