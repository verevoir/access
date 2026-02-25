import type { Guard } from './types.js';

/** Guard that passes if the identity has any of the specified roles. */
export function hasRole(...roles: string[]): Guard {
  return (identity) => roles.some((role) => identity.roles.includes(role));
}

/** Guard that passes if identity.id matches the owner in context. */
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
