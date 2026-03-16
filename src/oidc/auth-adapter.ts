import type { AuthAdapter, Identity } from '../types.js';

/** Standard OIDC token claims. */
export interface OIDCTokenPayload {
  /** Subject — unique user ID from the provider. */
  sub?: string;
  /** Email address. */
  email?: string;
  /** Whether the email has been verified. */
  email_verified?: boolean;
  /** Full name. */
  name?: string;
  /** Profile picture URL. */
  picture?: string;
  /** Audience. */
  aud?: string | string[];
  /** Issuer. */
  iss?: string;
  /** Expiration time (seconds since epoch). */
  exp?: number;
  [key: string]: unknown;
}

/**
 * Minimal interface for a JWT verifier that can validate tokens from any
 * OIDC-compliant provider.
 *
 * The consumer is responsible for configuring this with the provider's
 * JWKS endpoint (typically at `{issuer}/.well-known/openid-configuration`).
 * Compatible with `jose`, `openid-client`, or any standards-compliant library.
 */
export interface OIDCTokenVerifier {
  verify(token: string): Promise<OIDCTokenPayload>;
}

export interface OIDCAuthAdapterOptions {
  /** A verifier that validates and decodes tokens against the provider's JWKS. */
  verifier: OIDCTokenVerifier;
  /** Required — expected issuer URL (matches the `iss` claim). */
  issuer: string;
  /** Required — allowed audience values (matches the `aud` claim). */
  allowedAudiences: string[];
  /** Optional — map a token payload to roles. Defaults to `['viewer']`. */
  mapRoles?: (payload: OIDCTokenPayload) => string[] | Promise<string[]>;
}

/**
 * Create an auth adapter for any OIDC-compliant identity provider.
 *
 * Works with Okta, Azure AD, Auth0, Keycloak, or any provider that issues
 * standard OIDC tokens with a JWKS discovery endpoint.
 */
export function createOIDCAuthAdapter(
  options: OIDCAuthAdapterOptions,
): AuthAdapter {
  const { verifier, issuer, allowedAudiences, mapRoles } = options;

  return {
    resolve: async (token: unknown): Promise<Identity | null> => {
      if (!token || typeof token !== 'string') return null;

      try {
        const payload = await verifier.verify(token);

        if (!payload?.sub) return null;

        // Validate issuer
        if (payload.iss !== issuer) return null;

        // Validate audience
        if (payload.aud != null) {
          const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
          if (!aud.some((a) => allowedAudiences.includes(a))) return null;
        }

        // Check expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
          return null;

        const roles = mapRoles ? await mapRoles(payload) : ['viewer'];

        return {
          id: payload.sub,
          roles,
          metadata: {
            ...(payload.email != null && { email: payload.email }),
            ...(payload.name != null && { name: payload.name }),
            ...(payload.picture != null && { picture: payload.picture }),
            ...(payload.email_verified != null && {
              email_verified: payload.email_verified,
            }),
          },
        };
      } catch {
        return null;
      }
    },
  };
}
