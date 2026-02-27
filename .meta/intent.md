# Intent — @nextlake/access

## Purpose

Provide identity resolution, policy evaluation, and workflow state machines for structured content systems. Designed to work with NextLake but deliberately standalone — zero NextLake dependencies — so it is useful in any TypeScript application that needs role-based access control or editorial workflows.

## Goals

- Standalone: usable without any other NextLake package
- Policy as code: role-to-action mappings defined in TypeScript, auditable in version control
- Composable guards: small boolean functions (`hasRole`, `isOwner`) that combine with `and`/`or`/`not`
- Stateless workflows: the state machine evaluates transitions from current state, it does not store state

## Non-goals

- Handle authentication — this package consumes tokens and produces identities; login flows are the developer's problem
- Store roles or permissions — roles come from the identity provider, not from NextLake
- Manage workflow persistence — the developer stores the current state; the package evaluates transitions
- Enforce access at the storage layer — policy evaluation returns a boolean; enforcement is the caller's responsibility

## Key design decisions

- **Zero NextLake dependencies.** Access control is a general concern, not specific to content management. Keeping the package standalone makes it useful beyond NextLake and avoids coupling to the schema engine or storage adapter.
- **Identity, not authentication.** The `defineAuthAdapter` pattern separates "who is this token" from "how did they log in". This works with any IdP — JWT, session cookies, API keys — without the package knowing about any of them.
- **Stateless workflows.** `defineWorkflow` produces an evaluator, not a state store. Given a current state and an identity, it returns available transitions. This avoids duplicating storage and keeps the workflow logic pure and testable.
- **Guard combinators.** `and`, `or`, `not` compose guards into complex conditions without a custom DSL. Guards are plain functions, so developers can write their own.

## Constraints

- Zero runtime dependencies
- No imports from any `@nextlake/*` package
- Guards must be synchronous (no async evaluation in transition checks)
