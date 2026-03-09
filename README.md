# @verevoir/access

Identity resolution, policy evaluation, and workflow state machines — defined as code, not configuration. Zero runtime dependencies. Works with or without Verevoir.

## What It Does

- **Identity** — resolve tokens from any IdP into a standard `Identity` object
- **Policy** — define role→action mappings as code; evaluate with `can()`
- **Guards** — composable boolean predicates (`hasRole`, `isOwner`, `and`, `or`, `not`)
- **Workflow** — state machines with guard-protected transitions, defined as code

## Install

```bash
npm install @verevoir/access
```

## Quick Example

```typescript
import {
  defineAuthAdapter,
  definePolicy,
  defineWorkflow,
  hasRole,
  isOwner,
  or,
  can,
} from '@verevoir/access';

// Identity — bridge to your IdP
const auth = defineAuthAdapter({
  resolve: async (token) => {
    const user = await verifyJwt(token);
    return { id: user.sub, roles: user.roles, metadata: { email: user.email } };
  },
});

// Policy — who can do what
const policy = definePolicy({
  rules: [
    { role: 'admin', actions: ['create', 'read', 'update', 'delete'] },
    { role: 'editor', actions: ['create', 'read', 'update'] },
    { role: 'author', actions: ['create', 'read', 'update'], scope: 'own' },
    { role: 'viewer', actions: ['read'] },
  ],
});

// Workflow — content lifecycle
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

// Evaluate
const identity = await auth.resolve(token);
can(policy, identity, 'update', { ownerId: identity.id }); // true/false
publishing.canTransition('draft', 'review', identity); // true/false
publishing.availableTransitions('review', identity); // [Transition, ...]
```

## API

### Identity

| Export                           | Description                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| `defineAuthAdapter({ resolve })` | Create an adapter that resolves tokens into `Identity` objects |
| `Identity`                       | `{ id, roles, groups?, metadata? }`                            |
| `AuthAdapter`                    | `{ resolve(token): Promise<Identity \| null> }`                |

### Policy

| Export                                    | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| `definePolicy({ rules })`                 | Create a policy from role→action rules             |
| `can(policy, identity, action, context?)` | Evaluate whether an identity can perform an action |
| `PolicyRule`                              | `{ role, actions, scope?: 'all' \| 'own' }`        |

### Guards

| Export                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| `hasRole(...roles)`    | Passes if identity has any of the roles       |
| `isOwner(ownerField?)` | Passes if `identity.id` matches context owner |
| `and(...guards)`       | All guards must pass                          |
| `or(...guards)`        | Any guard must pass                           |
| `not(guard)`           | Inverts a guard                               |

### Workflow

| Export                                                     | Description                             |
| ---------------------------------------------------------- | --------------------------------------- |
| `defineWorkflow({ name, states, initial, transitions })`   | Create a stateless workflow evaluator   |
| `workflow.canTransition(from, to, identity, context?)`     | Check if a transition is allowed        |
| `workflow.availableTransitions(state, identity, context?)` | List transitions available from a state |

## Architecture

| File              | Responsibility                                                                  |
| ----------------- | ------------------------------------------------------------------------------- |
| `src/types.ts`    | Core interfaces: Identity, AuthAdapter, PolicyRule, Guard, Transition, Workflow |
| `src/auth.ts`     | `defineAuthAdapter()` — wraps a resolve function into an AuthAdapter            |
| `src/guards.ts`   | Composable guard functions                                                      |
| `src/policy.ts`   | `definePolicy()` and `can()` evaluation                                         |
| `src/workflow.ts` | `defineWorkflow()` — stateless state machine evaluator                          |
| `src/index.ts`    | Public API exports                                                              |

## Design Decisions

- **Identity, not authentication.** Consumes tokens from any OIDC/SSO/session provider; does not handle login flows.
- **Roles from the IdP.** Roles and groups come from the identity provider, not stored by Verevoir.
- **Policy as code.** Role→action mappings defined in TypeScript, not a database.
- **Workflows as code.** State machines are stateless evaluators — the developer stores current state in their document.
- **Zero runtime dependencies.** Standalone library, useful with or without Verevoir.

## Development

```bash
npm install    # Install dependencies
make build     # Compile TypeScript
make test      # Run test suite
make lint      # Check formatting
```
