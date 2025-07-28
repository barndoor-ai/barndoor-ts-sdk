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
