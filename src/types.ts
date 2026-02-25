/** A resolved user identity from any IdP. */
export interface Identity {
  /** Unique user identifier from the identity provider. */
  id: string;
  /** Resolved roles (from groups or direct assignment). */
  roles: string[];
  /** Raw group memberships from the IdP. */
  groups?: string[];
  /** Extra claims (email, name, etc.). */
  metadata?: Record<string, unknown>;
}

/** Resolves an opaque token into an Identity. Returns `null` if the token is invalid or expired. */
export interface AuthAdapter {
  resolve(token: unknown): Promise<Identity | null>;
}

/** Configuration for creating an AuthAdapter. */
export interface AuthAdapterConfig {
  resolve(token: unknown): Promise<Identity | null>;
}

/** A single role→actions mapping in a policy. */
export interface PolicyRule {
  /** The role this rule applies to. */
  role: string;
  /** Actions the role is allowed to perform. */
  actions: string[];
  /** 'own' restricts to documents the user created. Defaults to 'all'. */
  scope?: 'all' | 'own';
}

/** Configuration for creating a Policy. */
export interface PolicyConfig {
  rules: PolicyRule[];
}

/** A policy that evaluates role-based access. Deny-by-default. */
export interface Policy {
  rules: PolicyRule[];
  /** Check if the identity can perform the action. When a matching rule has `scope: 'own'`, `context.ownerId` must match `identity.id`. */
  can(
    identity: Identity,
    action: string,
    context?: { ownerId?: string },
  ): boolean;
}

/** A composable boolean predicate for access decisions. */
export type Guard = (
  identity: Identity,
  context?: Record<string, unknown>,
) => boolean;

/** A state transition in a workflow. Without a guard, the transition is open to everyone. */
export interface Transition {
  from: string;
  to: string;
  /** If set, the transition is only allowed when the guard returns `true`. */
  guard?: Guard;
}

/** Configuration for creating a Workflow. */
export interface WorkflowConfig {
  name: string;
  states: string[];
  initial: string;
  transitions: Transition[];
}

/**
 * A stateless workflow evaluator. Does not store state — the developer tracks
 * the current state in their own document/model.
 */
export interface Workflow {
  name: string;
  states: string[];
  initial: string;
  transitions: Transition[];
  /** Return all transitions from `currentState` whose guards pass for this identity. */
  availableTransitions(
    currentState: string,
    identity: Identity,
    context?: Record<string, unknown>,
  ): Transition[];
  /** Check whether a specific transition from `currentState` to `to` is allowed. */
  canTransition(
    currentState: string,
    to: string,
    identity: Identity,
    context?: Record<string, unknown>,
  ): boolean;
}
