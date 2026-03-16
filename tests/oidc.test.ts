import { describe, it, expect, beforeEach } from 'vitest';
import { createOIDCAuthAdapter } from '../src/oidc/auth-adapter.js';
import type {
  OIDCTokenVerifier,
  OIDCTokenPayload,
} from '../src/oidc/auth-adapter.js';

/** Minimal mock verifier that stores payloads in a Map. */
function createMockVerifier() {
  const tokens = new Map<string, OIDCTokenPayload>();

  const verifier: OIDCTokenVerifier = {
    verify: async (token: string) => {
      const payload = tokens.get(token);
      if (!payload) throw new Error('Invalid token');
      return payload;
    },
  };

  return { verifier, tokens };
}

const ISSUER = 'https://login.example.com';
const AUDIENCE = 'my-app-client-id';

const validPayload: OIDCTokenPayload = {
  sub: 'oidc-user-42',
  email: 'alice@example.com',
  email_verified: true,
  name: 'Alice Example',
  picture: 'https://cdn.example.com/alice.jpg',
  aud: AUDIENCE,
  iss: ISSUER,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe('createOIDCAuthAdapter', () => {
  let mock: ReturnType<typeof createMockVerifier>;

  beforeEach(() => {
    mock = createMockVerifier();
    mock.tokens.set('valid-token', validPayload);
  });

  it('resolves a valid token to an identity', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toEqual({
      id: 'oidc-user-42',
      roles: ['viewer'],
      metadata: {
        email: 'alice@example.com',
        name: 'Alice Example',
        picture: 'https://cdn.example.com/alice.jpg',
        email_verified: true,
      },
    });
  });

  it('returns null for empty token', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('')).toBeNull();
    expect(await adapter.resolve(null)).toBeNull();
    expect(await adapter.resolve(undefined)).toBeNull();
  });

  it('returns null for non-string token', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve(12345)).toBeNull();
    expect(await adapter.resolve({ token: 'x' })).toBeNull();
  });

  it('returns null for an invalid token (verify throws)', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('unknown-token')).toBeNull();
  });

  it('returns null when payload has no sub', async () => {
    mock.tokens.set('no-sub', {
      aud: AUDIENCE,
      iss: ISSUER,
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('no-sub')).toBeNull();
  });

  it('rejects wrong issuer', async () => {
    mock.tokens.set('bad-iss', {
      ...validPayload,
      iss: 'https://evil.com',
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('bad-iss')).toBeNull();
  });

  it('rejects wrong audience (string aud)', async () => {
    mock.tokens.set('bad-aud', {
      ...validPayload,
      aud: 'wrong-client',
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('bad-aud')).toBeNull();
  });

  it('rejects wrong audience (array aud)', async () => {
    mock.tokens.set('bad-aud-arr', {
      ...validPayload,
      aud: ['wrong-a', 'wrong-b'],
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('bad-aud-arr')).toBeNull();
  });

  it('accepts when one of multiple audiences matches', async () => {
    mock.tokens.set('multi-aud', {
      ...validPayload,
      aud: ['other-client', AUDIENCE],
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    const identity = await adapter.resolve('multi-aud');
    expect(identity).not.toBeNull();
    expect(identity!.id).toBe('oidc-user-42');
  });

  it('rejects expired token', async () => {
    mock.tokens.set('expired', {
      ...validPayload,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    expect(await adapter.resolve('expired')).toBeNull();
  });

  it('uses custom mapRoles', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
      mapRoles: (payload) =>
        payload.email === 'alice@example.com' ? ['admin'] : ['viewer'],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['admin']);
  });

  it('defaults to ["viewer"] without mapRoles', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['viewer']);
  });

  it('supports async mapRoles', async () => {
    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
      mapRoles: async () => {
        await new Promise((r) => setTimeout(r, 1));
        return ['editor'];
      },
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['editor']);
  });

  it('handles minimal payload (no optional claims)', async () => {
    mock.tokens.set('minimal', {
      sub: 'oidc-minimal',
      iss: ISSUER,
      aud: AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    const identity = await adapter.resolve('minimal');
    expect(identity).toEqual({
      id: 'oidc-minimal',
      roles: ['viewer'],
      metadata: {},
    });
  });

  it('accepts token without aud claim (no audience validation)', async () => {
    mock.tokens.set('no-aud', {
      sub: 'oidc-no-aud',
      iss: ISSUER,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const adapter = createOIDCAuthAdapter({
      verifier: mock.verifier,
      issuer: ISSUER,
      allowedAudiences: [AUDIENCE],
    });

    const identity = await adapter.resolve('no-aud');
    expect(identity).not.toBeNull();
    expect(identity!.id).toBe('oidc-no-aud');
  });
});
