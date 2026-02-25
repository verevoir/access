import { describe, it, expect } from 'vitest';
import { defineAuthAdapter } from '../src/auth.js';
import type { Identity } from '../src/types.js';

describe('defineAuthAdapter', () => {
  it('resolves a token to an identity', async () => {
    const adapter = defineAuthAdapter({
      resolve: async (token) => {
        if (token === 'valid-token') {
          return { id: 'user-1', roles: ['editor'] };
        }
        return null;
      },
    });

    const identity = await adapter.resolve('valid-token');
    expect(identity).toEqual({ id: 'user-1', roles: ['editor'] });
  });

  it('returns null for an invalid token', async () => {
    const adapter = defineAuthAdapter({
      resolve: async () => null,
    });

    const identity = await adapter.resolve('bad-token');
    expect(identity).toBeNull();
  });

  it('passes through metadata and groups', async () => {
    const adapter = defineAuthAdapter({
      resolve: async (): Promise<Identity> => ({
        id: 'user-2',
        roles: ['admin'],
        groups: ['engineering', 'leads'],
        metadata: { email: 'alice@example.com', name: 'Alice' },
      }),
    });

    const identity = await adapter.resolve('any-token');
    expect(identity).toEqual({
      id: 'user-2',
      roles: ['admin'],
      groups: ['engineering', 'leads'],
      metadata: { email: 'alice@example.com', name: 'Alice' },
    });
  });
});
