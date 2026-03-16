import type { AuthAdapter, Identity } from '../types.js';
import type { ApiKeyStore } from './store.js';

export interface ApiKeyAuthAdapterOptions {
  /** An API key store to verify credentials against. */
  store: ApiKeyStore;
  /** Map an API key's account ID to roles. Defaults to `['api']`. */
  mapRoles?: (accountId: string) => string[] | Promise<string[]>;
}

/**
 * Create an auth adapter that resolves API key credentials to an Identity.
 *
 * Expects the token to be a `clientId:secret` string (e.g. from a Basic auth header).
 * Either secret (primary or secondary) validates — enabling zero-downtime rotation.
 */
export function createApiKeyAuthAdapter(
  options: ApiKeyAuthAdapterOptions,
): AuthAdapter {
  const { store, mapRoles } = options;

  return {
    resolve: async (token: unknown): Promise<Identity | null> => {
      if (!token || typeof token !== 'string') return null;

      const separatorIndex = token.indexOf(':');
      if (separatorIndex === -1) return null;

      const clientId = token.slice(0, separatorIndex);
      const secret = token.slice(separatorIndex + 1);
      if (!clientId || !secret) return null;

      try {
        const key = await store.verify(clientId, secret);
        if (!key) return null;

        const roles = mapRoles ? await mapRoles(key.accountId) : ['api'];

        return {
          id: key.accountId,
          roles,
          metadata: { clientId: key.clientId },
        };
      } catch {
        return null;
      }
    },
  };
}
