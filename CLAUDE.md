# @verevoir/access — Access Control & Workflows

Identity resolution, policy evaluation, and workflow state machines for structured content. Standalone — works with or without Verevoir.

## What It Does

- **Identity** — resolve tokens from any IdP into a standard `Identity` object (id, roles, groups, metadata)
- **Policy** — define role→action mappings as code; evaluate with `can(identity, action, context)`
- **Guards** — composable boolean functions (`hasRole`, `isOwner`, `and`, `or`, `not`) used in policies and workflows
- **Workflow** — define state machines with guard-protected transitions; evaluate available transitions for a given identity

## Design Principles

- **Identity, not authentication** — consumes tokens; does not handle login flows
- **Roles from the IdP** — roles and groups come from the identity provider, not stored by Verevoir
- **Policy as code** — role→action mappings defined in TypeScript, not a database
- **Workflows as code** — state machines with guard-protected transitions
- **Zero runtime dependencies** — standalone library

## Quick Example

```typescript
import {
  defineAuthAdapter,
  definePolicy,
  defineWorkflow,
  hasRole,
  isOwner,
  and,
  or,
  can,
} from '@verevoir/access';

// Identity resolution
const auth = defineAuthAdapter({
  resolve: async (token) => {
    const user = await verifyJwt(token);
    return { id: user.sub, roles: user.roles, metadata: { email: user.email } };
  },
});

// Policy
const policy = definePolicy({
  rules: [
    { role: 'admin', actions: ['create', 'read', 'update', 'delete'] },
    { role: 'editor', actions: ['create', 'read', 'update'] },
    { role: 'author', actions: ['create', 'read', 'update'], scope: 'own' },
    { role: 'viewer', actions: ['read'] },
  ],
});

// Workflow
const publishing = defineWorkflow({
  name: 'publishing',
  states: ['draft', 'review', 'published', 'archived'],
  initial: 'draft',
  transitions: [
    {
      from: 'draft',
      to: 'review',
      guard: or(hasRole('author'), hasRole('editor')),
    },
    { from: 'review', to: 'published', guard: hasRole('editor') },
    { from: 'published', to: 'archived', guard: hasRole('admin') },
    { from: 'review', to: 'draft' },
  ],
});
```

## Setup

```bash
npm install
```

## Commands

```bash
make build   # Compile TypeScript
make test    # Run test suite
make lint    # Lint and check formatting
make run     # No-op (library, not a service)
```

## Architecture

- `src/types.ts` — Core interfaces: Identity, AuthAdapter, PolicyRule, Transition, Policy, Workflow
- `src/anonymous.ts` — `ANONYMOUS` frozen viewer identity, `isAnonymous()` structural check
- `src/auth.ts` — `defineAuthAdapter()` — wraps a resolve function into an AuthAdapter
- `src/guards.ts` — Composable guard functions: `hasRole`, `isOwner`, `and`, `or`, `not`
- `src/policy.ts` — `definePolicy()` — creates a policy from rules, `can()` for evaluation
- `src/workflow.ts` — `defineWorkflow()` — creates a stateless workflow evaluator
- `src/index.ts` — Public API exports
- `src/google/auth-adapter.ts` — `createGoogleAuthAdapter()` — verifies Google ID tokens via OAuth2Client
- `src/google.ts` — Subpath entry point (`@verevoir/access/google`)
- `src/test-accounts/auth-adapter.ts` — `createTestAuthAdapter()` — lookup-table adapter for development and testing
- `src/test-accounts.ts` — Subpath entry point (`@verevoir/access/test-accounts`)
- `src/role-store/store.ts` — `createRoleStore()` — persistent user→roles mapping backed by any StorageAdapter (structural typing, no import)
- `src/role-store.ts` — Subpath entry point (`@verevoir/access/role-store`)
