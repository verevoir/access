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

  it('returns ANONYMOUS for an unknown token', async () => {
    const identity = await adapter.resolve('unknown-token');
    expect(identity).toEqual(ANONYMOUS);
  });

  it('returns ANONYMOUS for null', async () => {
    const identity = await adapter.resolve(null);
    expect(identity).toEqual(ANONYMOUS);
  });

  it('returns ANONYMOUS for undefined', async () => {
    const identity = await adapter.resolve(undefined);
    expect(identity).toEqual(ANONYMOUS);
  });

  it('returns ANONYMOUS for empty string', async () => {
    const identity = await adapter.resolve('');
    expect(identity).toEqual(ANONYMOUS);
  });

  it('returns ANONYMOUS for non-string token', async () => {
    expect(await adapter.resolve(12345)).toEqual(ANONYMOUS);
    expect(await adapter.resolve({ token: 'x' })).toEqual(ANONYMOUS);
  });
});
