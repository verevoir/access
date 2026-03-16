import { describe, it, expect, beforeEach } from 'vitest';
import { createAppleAuthAdapter } from '../src/apple/auth-adapter.js';
import type {
  AppleTokenVerifier,
  AppleTokenPayload,
} from '../src/apple/auth-adapter.js';

/** Minimal mock verifier that stores payloads in a Map. */
function createMockVerifier() {
  const tokens = new Map<string, AppleTokenPayload>();

  const verifier: AppleTokenVerifier = {
    verify: async (token: string) => {
      const payload = tokens.get(token);
      if (!payload) throw new Error('Invalid token');
      return payload;
    },
  };

  return { verifier, tokens };
}

const CLIENT_ID = 'com.example.app';

const validPayload: AppleTokenPayload = {
  sub: 'apple-001234.abcdef',
  email: 'alice@privaterelay.appleid.com',
  email_verified: 'true',
  aud: CLIENT_ID,
  iss: 'https://appleid.apple.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

describe('createAppleAuthAdapter', () => {
  let mock: ReturnType<typeof createMockVerifier>;

  beforeEach(() => {
    mock = createMockVerifier();
    mock.tokens.set('valid-token', validPayload);
  });

  it('resolves a valid token to an identity', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toEqual({
      id: 'apple-001234.abcdef',
      roles: ['viewer'],
      metadata: {
        email: 'alice@privaterelay.appleid.com',
        email_verified: true,
      },
    });
  });

  it('returns null for empty token', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('')).toBeNull();
    expect(await adapter.resolve(null)).toBeNull();
    expect(await adapter.resolve(undefined)).toBeNull();
  });

  it('returns null for non-string token', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve(12345)).toBeNull();
    expect(await adapter.resolve({ token: 'x' })).toBeNull();
  });

  it('returns null for an invalid token (verify throws)', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('unknown-token')).toBeNull();
  });

  it('returns null when payload has no sub', async () => {
    mock.tokens.set('no-sub', {
      aud: CLIENT_ID,
      iss: 'https://appleid.apple.com',
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('no-sub')).toBeNull();
  });

  it('rejects wrong issuer', async () => {
    mock.tokens.set('bad-iss', {
      ...validPayload,
      iss: 'https://evil.com',
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('bad-iss')).toBeNull();
  });

  it('rejects wrong audience', async () => {
    mock.tokens.set('bad-aud', {
      ...validPayload,
      aud: 'com.other.app',
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('bad-aud')).toBeNull();
  });

  it('rejects expired token', async () => {
    mock.tokens.set('expired', {
      ...validPayload,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    expect(await adapter.resolve('expired')).toBeNull();
  });

  it('handles email_verified as boolean true', async () => {
    mock.tokens.set('bool-verified', {
      ...validPayload,
      email_verified: true,
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    const identity = await adapter.resolve('bool-verified');
    expect(identity!.metadata.email_verified).toBe(true);
  });

  it('handles email_verified as string "false"', async () => {
    mock.tokens.set('str-false', {
      ...validPayload,
      email_verified: 'false',
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    const identity = await adapter.resolve('str-false');
    expect(identity!.metadata.email_verified).toBe(false);
  });

  it('uses custom mapRoles', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
      mapRoles: () => ['admin'],
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['admin']);
  });

  it('defaults to ["viewer"] without mapRoles', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity!.roles).toEqual(['viewer']);
  });

  it('supports async mapRoles', async () => {
    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
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
      sub: 'apple-minimal',
      aud: CLIENT_ID,
      iss: 'https://appleid.apple.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const adapter = createAppleAuthAdapter({
      verifier: mock.verifier,
      clientId: CLIENT_ID,
    });

    const identity = await adapter.resolve('minimal');
    expect(identity).toEqual({
      id: 'apple-minimal',
      roles: ['viewer'],
      metadata: {},
    });
  });
});
