import type { Identity, Policy, PolicyConfig } from './types.js';

/**
 * Create a policy from a set of rules. The returned policy is deny-by-default —
 * access is only granted when a rule explicitly matches.
 */
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

/**
 * Evaluate whether an identity can perform an action under a policy.
 * Returns `true` on the first matching rule. Rules with `scope: 'own'`
 * only match when `context.ownerId` equals `identity.id`.
 * Returns `false` if no rule matches (deny-by-default).
 */
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
