import type { Identity } from './types.js';

/** A frozen identity for unauthenticated requests. Viewer role by default. */
export const ANONYMOUS: Identity = Object.freeze({
  id: 'anonymous',
  roles: ['viewer'],
});

/** Check whether an identity is anonymous (structural, works after serialization). */
export function isAnonymous(identity: Identity): boolean {
  return identity.id === 'anonymous';
}
