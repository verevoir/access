import type { AuthAdapter, Identity } from '../types.js';
import { ANONYMOUS } from '../anonymous.js';

/** A test account mapping a token string to an identity. */
export interface TestAccount {
  token: string;
  identity: Identity;
}

/** Behaviour when a token is missing, malformed, or unknown. */
export type UnknownTokenBehaviour = 'null' | 'anonymous';

export interface TestAuthAdapterOptions {
  accounts: TestAccount[];
  /**
   * What to resolve for missing / unknown tokens.
   *
   * - `'null'` (default) — matches the contract of the Google / Apple /
   *   OIDC adapters: an invalid token is an invalid token. Any consumer
   *   code that rejects on `!identity` works the same way as in prod.
   * - `'anonymous'` — legacy behaviour: fall back to the frozen
   *   ANONYMOUS viewer identity. Only choose this if every downstream
   *   path (including API auth) explicitly handles the anonymous case.
   *
   * Default changed from `'anonymous'` to `'null'` in v2.0.0 because
   * the old default made it easy to accidentally leave API routes
   * anonymously accessible when `AUTH_MODE=test` leaked into a
   * non-local environment.
   */
  unknownTokens?: UnknownTokenBehaviour;
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
  const unknownTokens = options.unknownTokens ?? 'null';
  const fallback: Identity | null =
    unknownTokens === 'anonymous' ? ANONYMOUS : null;

  return {
    resolve: async (token: unknown): Promise<Identity | null> => {
      if (!token || typeof token !== 'string') return fallback;
      return lookup.get(token) ?? fallback;
    },
  };
}
