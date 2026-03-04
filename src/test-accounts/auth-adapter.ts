import type { AuthAdapter, Identity } from '../types.js';
import { ANONYMOUS } from '../anonymous.js';

/** A test account mapping a token string to an identity. */
export interface TestAccount {
  token: string;
  identity: Identity;
}

export interface TestAuthAdapterOptions {
  accounts: TestAccount[];
}

/**
 * Create an auth adapter that resolves tokens from a fixed list of test accounts.
 *
 * For development and testing only. The import path (`@verevoir/access/test-accounts`)
 * is the safety mechanism — it stands out in code review. No runtime env checks needed.
 *
 * Named `create...` for consistency with `createGoogleAuthAdapter`.
 */
export function createTestAuthAdapter(
  options: TestAuthAdapterOptions,
): AuthAdapter {
  const lookup = new Map(
    options.accounts.map((account) => [account.token, account.identity]),
  );

  return {
    resolve: async (token: unknown): Promise<Identity> => {
      if (!token || typeof token !== 'string') return ANONYMOUS;
      return lookup.get(token) ?? ANONYMOUS;
    },
  };
}
