# ADR 001: Dual-Mode Auth via Subpath Exports

## Status

Accepted

## Context

Consumer applications need authentication during development and in production. These are fundamentally different environments:

- **Production** requires real identity verification — Google OAuth, token validation, secure session handling.
- **Development** needs fast iteration — no OAuth consent screens, no token refresh, no network calls. Developers need to switch between roles (admin, user, anonymous) instantly.

Three approaches were considered:

1. **Single adapter with a mock mode.** One import path, behaviour controlled by an environment variable. Risk: mock code ships to production if the env var is misconfigured. The safety boundary is a runtime check, not a structural one.

2. **Separate packages.** `@verevoir/access-google` and `@verevoir/access-test`. Solves the safety problem but fragments the package surface. Consumers need to discover and install separate packages.

3. **Subpath exports within one package.** `@verevoir/access/google` and `@verevoir/access/test-accounts` as separate entry points. Test code never appears in the production import graph. The safety boundary is structural — a code reviewer can grep for `test-accounts` in production code.

## Decision

Auth adapters are exposed as **subpath exports** from `@verevoir/access`:

- `@verevoir/access/google` — `createGoogleAuthAdapter(client, options?)` wraps `google-auth-library` (optional peer dependency)
- `@verevoir/access/test-accounts` — `createTestAuthAdapter(accounts)` maps fixed tokens to identities

Both return the same `AuthAdapter` interface:

```typescript
interface AuthAdapter {
  resolve(token: unknown): Promise<Identity | null>;
}
```

The consumer's application code selects the adapter at startup, typically based on an environment variable:

```typescript
const auth =
  process.env.AUTH_MODE === 'test'
    ? createTestAuthAdapter(testAccounts)
    : createGoogleAuthAdapter(oauthClient);
```

## Consequences

- **Import path is the safety mechanism.** `@verevoir/access/test-accounts` in production code is immediately visible in review. No runtime flag to misconfigure.
- **Google auth library is an optional peer dependency.** Consumers using only test accounts (or neither adapter) don't install `google-auth-library`. Consumers using Google auth get version alignment via peer deps.
- **Same interface, swappable.** All downstream code (policies, guards, workflows) works identically regardless of which adapter is active. No `if (mode === 'test')` branches leak into application logic.
- **Null vs ANONYMOUS semantics differ.** Google adapter returns `null` for invalid tokens (strict — the consumer decides how to handle failure). Test adapter returns `ANONYMOUS` for unknown tokens (permissive — safe for dev, never used in production).
- **Consumer owns the switching logic.** The package doesn't dictate how the mode is selected. Environment variable, feature flag, build-time constant — the consumer decides.
