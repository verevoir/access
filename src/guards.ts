import type { Guard } from './types.js';

/** Returns a guard that passes if the identity has **any** of the specified roles. */
export function hasRole(...roles: string[]): Guard {
  return (identity) => roles.some((role) => identity.roles.includes(role));
}

/**
 * Returns a guard that passes if `identity.id` matches `context[ownerField]`.
 * Defaults to looking up `context.ownerId`. Returns `false` if context is missing.
 */
export function isOwner(ownerField: string = 'ownerId'): Guard {
  return (identity, context) => {
    if (!context) return false;
    return identity.id === context[ownerField];
  };
}

/** Guard that passes only if all inner guards pass. */
export function and(...guards: Guard[]): Guard {
  return (identity, context) =>
    guards.every((guard) => guard(identity, context));
}

/** Guard that passes if any inner guard passes. */
export function or(...guards: Guard[]): Guard {
  return (identity, context) =>
    guards.some((guard) => guard(identity, context));
}

/** Guard that inverts another guard. */
export function not(guard: Guard): Guard {
  return (identity, context) => !guard(identity, context);
}
