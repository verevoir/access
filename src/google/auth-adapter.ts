import type { AuthAdapter, Identity } from '../types.js';

/** Subset of google-auth-library's TokenPayload used by the adapter. */
export interface TokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  hd?: string;
  aud?: string | string[];
  [key: string]: unknown;
}

/** Subset of google-auth-library's LoginTicket used by the adapter. */
export interface LoginTicket {
  getPayload(): TokenPayload | undefined;
}

/** Subset of google-auth-library's OAuth2Client used by the adapter. */
export interface OAuth2Client {
  verifyIdToken(options: {
    idToken: string;
    audience: string[];
  }): Promise<LoginTicket>;
}

export interface GoogleAuthAdapterOptions {
  /** Pre-configured OAuth2Client instance (dependency injection). */
  client: OAuth2Client;
  /** Required — allowed OAuth client IDs (matches the `aud` claim). */
  allowedClientIds: string[];
  /** Optional — restrict to a Google Workspace domain (matches the `hd` claim). */
  hostedDomain?: string;
  /** Optional — map a token payload to roles. Defaults to `['viewer']`. */
  mapRoles?: (payload: TokenPayload) => string[] | Promise<string[]>;
}

/**
 * Create an auth adapter that verifies Google ID tokens.
 *
 * Named `create...` (not `define...`) because it wraps an external client
 * rather than declaratively defining behaviour.
 */
export function createGoogleAuthAdapter(
  options: GoogleAuthAdapterOptions,
): AuthAdapter {
  const { client, allowedClientIds, hostedDomain, mapRoles } = options;

  return {
    resolve: async (token: unknown): Promise<Identity | null> => {
      if (!token || typeof token !== 'string') return null;

      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: allowedClientIds,
        });

        const payload = ticket.getPayload();
        if (!payload?.sub) return null;

        if (hostedDomain && payload.hd !== hostedDomain) return null;

        const roles = mapRoles ? await mapRoles(payload) : ['viewer'];

        return {
          id: payload.sub,
          roles,
          metadata: {
            ...(payload.email != null && { email: payload.email }),
            ...(payload.name != null && { name: payload.name }),
            ...(payload.picture != null && { picture: payload.picture }),
          },
        };
      } catch {
        return null;
      }
    },
  };
}
