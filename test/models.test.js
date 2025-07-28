/**
 * Tests for data models.
 */

import { ServerSummary, ServerDetail, AgentToken } from '../dist/index.esm.js';

describe('ServerSummary', () => {
  const validServerData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Server',
    slug: 'test-server',
    provider: 'github',
    connection_status: 'connected'
  };

  test('creates ServerSummary with valid data', () => {
    const server = new ServerSummary(validServerData);
    
    expect(server.id).toBe(validServerData.id);
    expect(server.name).toBe(validServerData.name);
    expect(server.slug).toBe(validServerData.slug);
    expect(server.provider).toBe(validServerData.provider);
    expect(server.connection_status).toBe(validServerData.connection_status);
  });

  test('handles null provider', () => {
    const dataWithoutProvider = { ...validServerData };
    delete dataWithoutProvider.provider;
    
    const server = new ServerSummary(dataWithoutProvider);
    expect(server.provider).toBeNull();
  });

  test('throws error for missing required fields', () => {
    expect(() => new ServerSummary({})).toThrow('ServerSummary missing required fields');
    
    expect(() => new ServerSummary({ 
      name: 'Test', 
      slug: 'test', 
      connection_status: 'available' 
    })).toThrow('ServerSummary missing required fields');
  });

  test('fromApiResponse creates ServerSummary', () => {
    const server = ServerSummary.fromApiResponse(validServerData);
    expect(server).toBeInstanceOf(ServerSummary);
    expect(server.id).toBe(validServerData.id);
  });
});

describe('ServerDetail', () => {
  const validDetailData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Server',
    slug: 'test-server',
    provider: 'github',
    connection_status: 'connected',
    url: 'https://api.example.com/mcp'
  };

  test('creates ServerDetail with valid data', () => {
    const server = new ServerDetail(validDetailData);
    
    expect(server.id).toBe(validDetailData.id);
    expect(server.name).toBe(validDetailData.name);
    expect(server.slug).toBe(validDetailData.slug);
    expect(server.provider).toBe(validDetailData.provider);
    expect(server.connection_status).toBe(validDetailData.connection_status);
    expect(server.url).toBe(validDetailData.url);
  });

  test('extends ServerSummary', () => {
    const server = new ServerDetail(validDetailData);
    expect(server).toBeInstanceOf(ServerSummary);
  });

  test('handles null url', () => {
    const dataWithoutUrl = { ...validDetailData };
    delete dataWithoutUrl.url;
    
    const server = new ServerDetail(dataWithoutUrl);
    expect(server.url).toBeNull();
  });

  test('fromApiResponse creates ServerDetail', () => {
    const server = ServerDetail.fromApiResponse(validDetailData);
    expect(server).toBeInstanceOf(ServerDetail);
    expect(server.url).toBe(validDetailData.url);
  });
});

describe('AgentToken', () => {
  const validTokenData = {
    agent_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    expires_in: 3600
  };

  test('creates AgentToken with valid data', () => {
    const token = new AgentToken(validTokenData);
    
    expect(token.agent_token).toBe(validTokenData.agent_token);
    expect(token.expires_in).toBe(validTokenData.expires_in);
  });

  test('throws error for missing agent_token', () => {
    expect(() => new AgentToken({ expires_in: 3600 })).toThrow('AgentToken missing required fields');
  });

  test('throws error for missing expires_in', () => {
    expect(() => new AgentToken({ agent_token: 'token' })).toThrow('AgentToken missing required fields');
  });

  test('throws error for invalid expires_in type', () => {
    expect(() => new AgentToken({ 
      agent_token: 'token', 
      expires_in: 'not-a-number' 
    })).toThrow('AgentToken missing required fields');
  });

  test('fromApiResponse creates AgentToken', () => {
    const token = AgentToken.fromApiResponse(validTokenData);
    expect(token).toBeInstanceOf(AgentToken);
    expect(token.agent_token).toBe(validTokenData.agent_token);
  });
});

describe('Model Validation', () => {
  test('models validate required fields strictly', () => {
    // ServerSummary requires all core fields
    expect(() => new ServerSummary({
      id: 'test-id',
      name: 'Test',
      slug: 'test'
      // missing connection_status
    })).toThrow();

    // AgentToken requires both fields
    expect(() => new AgentToken({
      agent_token: 'token'
      // missing expires_in
    })).toThrow();
  });

  test('models handle optional fields correctly', () => {
    const serverWithoutProvider = new ServerSummary({
      id: 'test-id',
      name: 'Test',
      slug: 'test',
      connection_status: 'available'
    });
    expect(serverWithoutProvider.provider).toBeNull();

    const detailWithoutUrl = new ServerDetail({
      id: 'test-id',
      name: 'Test',
      slug: 'test',
      connection_status: 'available'
    });
    expect(detailWithoutUrl.url).toBeNull();
  });
});
