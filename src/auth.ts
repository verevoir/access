import type { AuthAdapter, AuthAdapterConfig } from './types.js';

/** Create an auth adapter from a resolve function. */
export function defineAuthAdapter(config: AuthAdapterConfig): AuthAdapter {
  return {
    resolve: config.resolve,
  };
}
