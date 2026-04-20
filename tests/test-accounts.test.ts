import { describe, it, expect } from 'vitest';
import { createTestAuthAdapter } from '../src/test-accounts/auth-adapter.js';
import { ANONYMOUS } from '../src/anonymous.js';
import type { Identity } from '../src/types.js';

const alice: Identity = {
  id: 'user-alice',
  roles: ['admin'],
  metadata: { email: 'alice@example.com', name: 'Alice Admin' },
};

const bob: Identity = {
  id: 'user-bob',
  roles: ['editor'],
  metadata: { email: 'bob@example.com', name: 'Bob Editor' },
};

const adapter = createTestAuthAdapter({
  accounts: [
    { token: 'alice-token', identity: alice },
    { token: 'bob-token', identity: bob },
  ],
});

describe('createTestAuthAdapter', () => {
  it('resolves a valid token to the correct identity', async () => {
    const identity = await adapter.resolve('alice-token');
    expect(identity).toEqual(alice);
  });

  it('resolves multiple accounts independently', async () => {
    expect(await adapter.resolve('alice-token')).toEqual(alice);
    expect(await adapter.resolve('bob-token')).toEqual(bob);
  });

  describe('default (unknownTokens: "null")', () => {
    it('returns null for an unknown token', async () => {
      const identity = await adapter.resolve('unknown-token');
      expect(identity).toBeNull();
    });

    it('returns null for null', async () => {
      expect(await adapter.resolve(null)).toBeNull();
    });

    it('returns null for undefined, empty string, or non-string tokens', async () => {
      expect(await adapter.resolve(undefined)).toBeNull();
      expect(await adapter.resolve('')).toBeNull();
      expect(await adapter.resolve(12345)).toBeNull();
      expect(await adapter.resolve({ token: 'x' })).toBeNull();
    });
  });

  describe('unknownTokens: "anonymous" (opt-in legacy behaviour)', () => {
    const legacy = createTestAuthAdapter({
      accounts: [{ token: 'alice-token', identity: alice }],
      unknownTokens: 'anonymous',
    });

    it('returns ANONYMOUS for an unknown token', async () => {
      expect(await legacy.resolve('unknown-token')).toEqual(ANONYMOUS);
    });

    it('returns ANONYMOUS for null / undefined / empty / non-string', async () => {
      expect(await legacy.resolve(null)).toEqual(ANONYMOUS);
      expect(await legacy.resolve(undefined)).toEqual(ANONYMOUS);
      expect(await legacy.resolve('')).toEqual(ANONYMOUS);
      expect(await legacy.resolve(12345)).toEqual(ANONYMOUS);
    });

    it('still resolves known tokens normally', async () => {
      expect(await legacy.resolve('alice-token')).toEqual(alice);
    });
  });
});
