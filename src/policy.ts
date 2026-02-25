import type { Identity, Policy, PolicyConfig } from './types.js';

/** Create a policy from a set of rules. */
export function definePolicy(config: PolicyConfig): Policy {
  return {
    rules: config.rules,
    can(
      identity: Identity,
      action: string,
      context?: { ownerId?: string },
    ): boolean {
      return can(this, identity, action, context);
    },
  };
}

/** Evaluate whether an identity can perform an action under a policy. */
export function can(
  policy: Policy,
  identity: Identity,
  action: string,
  context?: { ownerId?: string },
): boolean {
  for (const rule of policy.rules) {
    if (!identity.roles.includes(rule.role)) continue;
    if (!rule.actions.includes(action)) continue;

    if (rule.scope === 'own') {
      if (context?.ownerId === identity.id) return true;
    } else {
      return true;
    }
  }
  return false;
}
