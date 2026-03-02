import { describe, it, expect, beforeEach } from 'vitest';
import { createGoogleAuthAdapter } from '../src/google/auth-adapter.js';
import type {
  OAuth2Client,
  TokenPayload,
  LoginTicket,
} from '../src/google/auth-adapter.js';

/** Minimal mock of OAuth2Client that stores payloads in a Map. */
function createMockClient() {
  const tokens = new Map<string, TokenPayload>();

  const client: OAuth2Client = {
    verifyIdToken: async ({ idToken, audience }) => {
      const payload = tokens.get(idToken);
      if (!payload) {
        throw new Error('Invalid token');
      }

      // Simulate audience check
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const match = audience.some((a) => aud.includes(a));
      if (!match) {
        throw new Error('Token audience mismatch');
      }

      const ticket: LoginTicket = {
        getPayload: () => payload,
      };
      return ticket;
    },
  };

  return { client, tokens };
}

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const validPayload: TokenPayload = {
  sub: 'google-114823947',
  email: 'alice@example.com',
  email_verified: true,
  name: 'Alice Admin',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
  hd: 'example.com',
  aud: CLIENT_ID,
};

describe('createGoogleAuthAdapter', () => {
  let mock: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mock = createMockClient();
    mock.tokens.set('valid-token', validPayload);
  });

  it('resolves a valid token to an identity', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toEqual({
      id: 'google-114823947',
      roles: ['viewer'],
      metadata: {
        email: 'alice@example.com',
        name: 'Alice Admin',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      },
    });
  });

  it('returns null for empty token', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    expect(await adapter.resolve('')).toBeNull();
    expect(await adapter.resolve(null)).toBeNull();
    expect(await adapter.resolve(undefined)).toBeNull();
  });

  it('returns null for non-string token', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    expect(await adapter.resolve(12345)).toBeNull();
    expect(await adapter.resolve({ token: 'x' })).toBeNull();
  });

  it('returns null for an invalid token (verifyIdToken throws)', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    const identity = await adapter.resolve('invalid-token');
    expect(identity).toBeNull();
  });

  it('returns null when payload has no sub', async () => {
    mock.tokens.set('no-sub-token', { aud: CLIENT_ID });

    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    const identity = await adapter.resolve('no-sub-token');
    expect(identity).toBeNull();
  });

  it('rejects wrong audience', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: ['wrong-client-id'],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toBeNull();
  });

  it('filters by hosted domain', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
      hostedDomain: 'other.com',
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toBeNull();
  });

  it('allows matching hosted domain', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
      hostedDomain: 'example.com',
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).not.toBeNull();
    expect(identity!.id).toBe('google-114823947');
  });

  it('uses custom mapRoles', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
      mapRoles: (payload) =>
        payload.hd === 'example.com' ? ['admin'] : ['viewer'],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['admin']);
  });

  it('defaults to ["viewer"] without mapRoles', async () => {
    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['viewer']);
  });

  it('handles missing optional claims gracefully', async () => {
    mock.tokens.set('minimal-token', {
      sub: 'google-minimal',
      aud: CLIENT_ID,
    });

    const adapter = createGoogleAuthAdapter({
      client: mock.client,
      allowedClientIds: [CLIENT_ID],
    });

    const identity = await adapter.resolve('minimal-token');
    expect(identity).toEqual({
      id: 'google-minimal',
      roles: ['viewer'],
      metadata: {},
    });
  });
});
