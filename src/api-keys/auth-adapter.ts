import type { AuthAdapter, Identity } from '../types.js';
import type { ApiKeyStore } from './store.js';

export interface ApiKeyAuthAdapterOptions {
  /** An API key store to verify credentials against. */
  store: ApiKeyStore;
  /** Map an API key's account ID to roles. Defaults to `['api']`. */
  mapRoles?: (accountId: string) => string[] | Promise<string[]>;
}

/**
 * Prefix used on `Identity.id` for API-key-authenticated identities.
 * Keeps them in a separate namespace from user ids, so that any consumer
 * code that maps `identity.id` → user (memberships, profile lookups) can
 * detect and handle API identities explicitly rather than treating them
 * as unknown users.
 */
export const API_KEY_IDENTITY_PREFIX = 'apikey:';

/**
 * Structural check for an API-key identity. Use in consumer auth flows
 * to branch between user-identity handling and API-identity handling.
 */
export function isApiKeyIdentity(identity: Identity): boolean {
  return identity.id.startsWith(API_KEY_IDENTITY_PREFIX);
}

/**
 * Create an auth adapter that resolves API key credentials to an Identity.
 *
 * Expects the token to be a `clientId:secret` string (e.g. from a Basic auth header).
 * Either secret (primary or secondary) validates — enabling zero-downtime rotation.
 *
 * The resolved identity looks like:
 *
 * ```
 * { id: 'apikey:<clientId>', roles: ['api'], metadata: { clientId, accountId } }
 * ```
 *
 * `metadata.accountId` is the tenant the key belongs to — consumer code
 * should read it from metadata rather than reinterpreting `identity.id`
 * as an account id. The `apikey:` prefix on `id` is deliberate: mixing
 * user ids and account ids in the same field was the bug that caused
 * auto-created ghost accounts in earlier versions.
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
          id: `${API_KEY_IDENTITY_PREFIX}${key.clientId}`,
          roles,
          metadata: { clientId: key.clientId, accountId: key.accountId },
        };
      } catch {
        return null;
      }
    },
  };
}
