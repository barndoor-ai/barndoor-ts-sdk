/**
 * Data models for the Barndoor SDK.
 * 
 * This module defines the data models used for API requests and responses,
 * providing type safety and validation that mirrors the Python SDK's Pydantic models.
 */

/**
 * Summary information about an MCP server.
 * 
 * Represents basic server information as returned by the list servers
 * endpoint. This is a lightweight representation suitable for listing
 * many servers at once.
 */
export class ServerSummary {
  /**
   * @param {Object} data - Server data
   * @param {string} data.id - Unique identifier (UUID) for the server
   * @param {string} data.name - Human-readable name of the server
   * @param {string} data.slug - URL-friendly identifier used in API paths
   * @param {string|null} [data.provider] - Third-party provider name (e.g., "github", "slack")
   * @param {string} data.connection_status - Current connection status: "available", "pending", or "connected"
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.provider = data.provider || null;
    this.connection_status = data.connection_status;
    
    // Validate required fields
    if (!this.id || !this.name || !this.slug || !this.connection_status) {
      throw new Error('ServerSummary missing required fields');
    }
  }
  
  /**
   * Create a ServerSummary from API response data.
   * @param {Object} data - Raw API response data
   * @returns {ServerSummary}
   */
  static fromApiResponse(data) {
    return new ServerSummary(data);
  }
}

/**
 * Detailed information about an MCP server.
 * 
 * Extends ServerSummary with additional fields returned when fetching
 * a single server's details.
 */
export class ServerDetail extends ServerSummary {
  /**
   * @param {Object} data - Server data
   * @param {string|null} [data.url] - MCP base URL from the server directory
   */
  constructor(data) {
    super(data);
    this.url = data.url || null;
  }
  
  /**
   * Create a ServerDetail from API response data.
   * @param {Object} data - Raw API response data
   * @returns {ServerDetail}
   */
  static fromApiResponse(data) {
    return new ServerDetail(data);
  }
}

/**
 * Response from the agent token exchange endpoint.
 * 
 * Contains the agent access token and expiration information returned
 * when exchanging client credentials.
 */
export class AgentToken {
  /**
   * @param {Object} data - Token data
   * @param {string} data.agent_token - The agent access token to use for agent operations
   * @param {number} data.expires_in - Token lifetime in seconds
   */
  constructor(data) {
    this.agent_token = data.agent_token;
    this.expires_in = data.expires_in;
    
    // Validate required fields
    if (!this.agent_token || typeof this.expires_in !== 'number') {
      throw new Error('AgentToken missing required fields');
    }
  }
  
  /**
   * Create an AgentToken from API response data.
   * @param {Object} data - Raw API response data
   * @returns {AgentToken}
   */
  static fromApiResponse(data) {
    return new AgentToken(data);
  }
}
