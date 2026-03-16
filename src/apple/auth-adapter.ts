import type { AuthAdapter, Identity } from '../types.js';

/** Decoded claims from an Apple ID token. */
export interface AppleTokenPayload {
  /** Subject — stable unique user ID from Apple. */
  sub?: string;
  /** Email address (may only be provided on first sign-in). */
  email?: string;
  /** Whether the email has been verified by Apple. */
  email_verified?: string | boolean;
  /** Audience — your Services ID or App ID. */
  aud?: string;
  /** Issuer — always `https://appleid.apple.com`. */
  iss?: string;
  /** Expiration time (seconds since epoch). */
  exp?: number;
  /** Issued-at time (seconds since epoch). */
  iat?: number;
  [key: string]: unknown;
}

/**
 * Minimal interface for a JWT verifier that can validate Apple ID tokens.
 *
 * Compatible with `jose`, `jsonwebtoken`, or any library that can verify
 * a JWT against Apple's JWKS endpoint.
 */
export interface AppleTokenVerifier {
  verify(token: string): Promise<AppleTokenPayload>;
}

export interface AppleAuthAdapterOptions {
  /** A verifier that validates and decodes Apple ID tokens against Apple's JWKS. */
  verifier: AppleTokenVerifier;
  /** Required — your Services ID or App Bundle ID (matches the `aud` claim). */
  clientId: string;
  /** Optional — map a token payload to roles. Defaults to `['viewer']`. */
  mapRoles?: (payload: AppleTokenPayload) => string[] | Promise<string[]>;
}

/**
 * Create an auth adapter that verifies Apple ID tokens.
 *
 * Apple Sign-In returns a JWT signed with Apple's keys. The consumer provides
 * a verifier (e.g. using `jose` to fetch Apple's JWKS at
 * `https://appleid.apple.com/auth/keys`) and this adapter validates the
 * claims and builds an Identity.
 */
export function createAppleAuthAdapter(
  options: AppleAuthAdapterOptions,
): AuthAdapter {
  const { verifier, clientId, mapRoles } = options;

  return {
    resolve: async (token: unknown): Promise<Identity | null> => {
      if (!token || typeof token !== 'string') return null;

      try {
        const payload = await verifier.verify(token);

        if (!payload?.sub) return null;

        // Validate issuer
        if (payload.iss && payload.iss !== 'https://appleid.apple.com')
          return null;

        // Validate audience
        if (payload.aud && payload.aud !== clientId) return null;

        // Check expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
          return null;

        const roles = mapRoles ? await mapRoles(payload) : ['viewer'];

        return {
          id: payload.sub,
          roles,
          metadata: {
            ...(payload.email != null && { email: payload.email }),
            ...(payload.email_verified != null && {
              email_verified: String(payload.email_verified) === 'true',
            }),
          },
        };
      } catch {
        return null;
      }
    },
  };
}
