import { describe, expect, it } from 'vitest';
import { toRegistryResult } from '../../api/_lib/mcpRegistry.js';

const entry = (server: Record<string, unknown>) => ({ server });

describe('reading the public MCP registry', () => {
  it('keeps a server with a streamable-http remote', () => {
    const result = toRegistryResult(entry({
      name: 'ai.smithery/national-weather-service',
      title: 'National Weather Service',
      description: '  Real-time   weather  for the US. ',
      version: '1.0.0',
      remotes: [{ type: 'streamable-http', url: 'https://server.example.com/mcp' }],
      repository: { url: 'https://github.com/example/servers' },
    }));

    expect(result).toMatchObject({
      name: 'ai.smithery/national-weather-service',
      title: 'National Weather Service',
      description: 'Real-time weather for the US.',
      remoteUrl: 'https://server.example.com/mcp',
      requiresAuth: false,
      repositoryUrl: 'https://github.com/example/servers',
    });
  });

  it('drops a server with no remote endpoint', () => {
    // A stdio package runs as a local process. This product cannot host one,
    // so offering it would be offering something that cannot work.
    expect(toRegistryResult(entry({
      name: 'example/local-only',
      packages: [{ registryType: 'npm', identifier: 'example-mcp' }],
    }))).toBeNull();
  });

  it('drops a remote that is not https', () => {
    expect(toRegistryResult(entry({
      name: 'example/insecure',
      remotes: [{ type: 'streamable-http', url: 'http://plain.example.com/mcp' }],
    }))).toBeNull();
  });

  it('drops a transport the client cannot speak', () => {
    expect(toRegistryResult(entry({
      name: 'example/websocket',
      remotes: [{ type: 'websocket', url: 'https://ws.example.com/mcp' }],
    }))).toBeNull();
  });

  it('prefers streamable-http when a server publishes both', () => {
    const result = toRegistryResult(entry({
      name: 'example/both',
      remotes: [
        { type: 'sse', url: 'https://legacy.example.com/sse' },
        { type: 'streamable-http', url: 'https://modern.example.com/mcp' },
      ],
    }));
    expect(result?.remoteUrl).toBe('https://modern.example.com/mcp');
  });

  it('falls back to sse when that is all there is', () => {
    const result = toRegistryResult(entry({
      name: 'example/legacy',
      remotes: [{ type: 'sse', url: 'https://legacy.example.com/sse' }],
    }));
    expect(result?.remoteUrl).toBe('https://legacy.example.com/sse');
  });

  it('flags a server that will need a token from the user', () => {
    const result = toRegistryResult(entry({
      name: 'example/authed',
      remotes: [{
        type: 'streamable-http',
        url: 'https://server.example.com/mcp',
        headers: [{ name: 'Authorization', isSecret: true, isRequired: true }],
      }],
    }));
    expect(result?.requiresAuth).toBe(true);
  });

  it('bounds every field, because a registry entry is written by a stranger', () => {
    const result = toRegistryResult(entry({
      name: 'x'.repeat(500),
      title: 'y'.repeat(500),
      description: 'z'.repeat(2000),
      remotes: [{ type: 'streamable-http', url: 'https://server.example.com/mcp' }],
    }));
    expect(result!.name.length).toBeLessThanOrEqual(200);
    expect(result!.title.length).toBeLessThanOrEqual(120);
    expect(result!.description.length).toBeLessThanOrEqual(400);
  });

  it('ignores an entry with no name', () => {
    expect(toRegistryResult(entry({
      remotes: [{ type: 'streamable-http', url: 'https://server.example.com/mcp' }],
    }))).toBeNull();
    expect(toRegistryResult({} as never)).toBeNull();
  });
});
