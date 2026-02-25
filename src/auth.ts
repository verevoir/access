import type { AuthAdapter, AuthAdapterConfig } from './types.js';

/**
 * Create an auth adapter that bridges to your identity provider.
 * The `resolve` function receives whatever token your app uses (JWT, session cookie, etc.)
 * and returns an {@link Identity} or `null` if the token is invalid.
 */
export function defineAuthAdapter(config: AuthAdapterConfig): AuthAdapter {
  return {
    resolve: config.resolve,
  };
}
