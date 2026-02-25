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

/** Resolves an opaque token into an Identity. */
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

/** A policy that evaluates role-based access. */
export interface Policy {
  rules: PolicyRule[];
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

/** A state transition in a workflow. */
export interface Transition {
  from: string;
  to: string;
  guard?: Guard;
}

/** Configuration for creating a Workflow. */
export interface WorkflowConfig {
  name: string;
  states: string[];
  initial: string;
  transitions: Transition[];
}

/** A stateless workflow evaluator. */
export interface Workflow {
  name: string;
  states: string[];
  initial: string;
  transitions: Transition[];
  availableTransitions(
    currentState: string,
    identity: Identity,
    context?: Record<string, unknown>,
  ): Transition[];
  canTransition(
    currentState: string,
    to: string,
    identity: Identity,
    context?: Record<string, unknown>,
  ): boolean;
}
