import { describe, it, expect, beforeEach } from 'vitest';
import { createApiKeyStore } from '../src/api-keys/store.js';
import { createApiKeyAuthAdapter } from '../src/api-keys/auth-adapter.js';
import type { ApiKeyStore } from '../src/api-keys/store.js';
import type { StorageAdapter } from '../src/api-keys/types.js';

/** Minimal in-memory StorageAdapter. */
function createMemoryStorage(): StorageAdapter {
  let nextId = 1;
  const docs = new Map<
    string,
    { id: string; blockType: string; data: Record<string, unknown> }
  >();

  return {
    async create(blockType, data) {
      const id = `${blockType}-${nextId++}`;
      const doc = { id, blockType, data: structuredClone(data) };
      docs.set(id, doc);
      return { id, data: structuredClone(data) };
    },
    async list(blockType, options) {
      const results: { id: string; data: Record<string, unknown> }[] = [];
      for (const doc of docs.values()) {
        if (doc.blockType !== blockType) continue;
        if (options?.where) {
          const match = Object.entries(options.where).every(
            ([k, v]) => (k === 'id' ? doc.id === v : doc.data[k] === v),
          );
          if (!match) continue;
        }
        results.push({ id: doc.id, data: structuredClone(doc.data) });
      }
      return results;
    },
    async update(id, data) {
      const existing = docs.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      existing.data = structuredClone(data);
      return { id, data: structuredClone(data) };
    },
    async delete(id) {
      docs.delete(id);
    },
  };
}

/** Trivial hash/verify for testing — prefix with "hashed:". */
const hashSecret = (raw: string) => `hashed:${raw}`;
const verifySecret = (raw: string, hash: string) => hash === `hashed:${raw}`;

describe('createApiKeyStore', () => {
  let store: ApiKeyStore;

  beforeEach(() => {
    store = createApiKeyStore({
      storage: createMemoryStorage(),
      hashSecret,
      verifySecret,
    });
  });

  it('creates a key with hashed secrets and provenance', async () => {
    const key = await store.create(
      'cli_abc',
      'acc_1',
      'secret-primary',
      'secret-secondary',
      'user-admin',
    );

    expect(key.clientId).toBe('cli_abc');
    expect(key.accountId).toBe('acc_1');
    expect(key.primary.hash).toBe('hashed:secret-primary');
    expect(key.primary.createdBy).toBe('user-admin');
    expect(key.secondary.hash).toBe('hashed:secret-secondary');
    expect(key.secondary.createdBy).toBe('user-admin');
    expect(key.createdAt).toBeGreaterThan(0);
  });

  it('retrieves a key by client ID', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 's', 'admin');
    const found = await store.getByClientId('cli_abc');
    expect(found).not.toBeNull();
    expect(found!.clientId).toBe('cli_abc');
  });

  it('returns null for unknown client ID', async () => {
    expect(await store.getByClientId('nonexistent')).toBeNull();
  });

  it('verifies against primary secret', async () => {
    await store.create('cli_abc', 'acc_1', 'primary-s', 'secondary-s', 'admin');
    const key = await store.verify('cli_abc', 'primary-s');
    expect(key).not.toBeNull();
    expect(key!.clientId).toBe('cli_abc');
  });

  it('verifies against secondary secret', async () => {
    await store.create('cli_abc', 'acc_1', 'primary-s', 'secondary-s', 'admin');
    const key = await store.verify('cli_abc', 'secondary-s');
    expect(key).not.toBeNull();
  });

  it('returns null for wrong secret', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 's', 'admin');
    expect(await store.verify('cli_abc', 'wrong')).toBeNull();
  });

  it('returns null for unknown client ID on verify', async () => {
    expect(await store.verify('nonexistent', 'any')).toBeNull();
  });

  it('rotates the primary secret', async () => {
    await store.create('cli_abc', 'acc_1', 'old-p', 'old-s', 'admin');
    const rotated = await store.rotatePrimary('cli_abc', 'new-p', 'user-ops');

    expect(rotated.primary.hash).toBe('hashed:new-p');
    expect(rotated.primary.createdBy).toBe('user-ops');
    // Secondary unchanged
    expect(rotated.secondary.hash).toBe('hashed:old-s');

    // Old primary no longer works
    expect(await store.verify('cli_abc', 'old-p')).toBeNull();
    // New primary works
    expect(await store.verify('cli_abc', 'new-p')).not.toBeNull();
    // Secondary still works
    expect(await store.verify('cli_abc', 'old-s')).not.toBeNull();
  });

  it('rotates the secondary secret', async () => {
    await store.create('cli_abc', 'acc_1', 'old-p', 'old-s', 'admin');
    const rotated = await store.rotateSecondary('cli_abc', 'new-s', 'user-ops');

    expect(rotated.secondary.hash).toBe('hashed:new-s');
    expect(rotated.secondary.createdBy).toBe('user-ops');
    // Primary unchanged
    expect(rotated.primary.hash).toBe('hashed:old-p');
  });

  it('throws when rotating a nonexistent key', async () => {
    await expect(
      store.rotatePrimary('nonexistent', 'x', 'admin'),
    ).rejects.toThrow('not found');
  });

  it('lists keys by account', async () => {
    await store.create('cli_1', 'acc_1', 'p', 's', 'admin');
    await store.create('cli_2', 'acc_1', 'p', 's', 'admin');
    await store.create('cli_3', 'acc_2', 'p', 's', 'admin');

    const keys = await store.listByAccount('acc_1');
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.clientId).sort()).toEqual(['cli_1', 'cli_2']);
  });

  it('revokes a key', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 's', 'admin');
    await store.revoke('cli_abc');
    expect(await store.getByClientId('cli_abc')).toBeNull();
  });

  it('revoking a nonexistent key is a no-op', async () => {
    await store.revoke('nonexistent'); // should not throw
  });
});

describe('createApiKeyAuthAdapter', () => {
  let keyStore: ApiKeyStore;

  beforeEach(async () => {
    keyStore = createApiKeyStore({
      storage: createMemoryStorage(),
      hashSecret,
      verifySecret,
    });
    await keyStore.create('cli_abc', 'acc_1', 'my-secret', 'backup-secret', 'admin');
  });

  it('resolves a valid clientId:secret to an Identity', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    const identity = await adapter.resolve('cli_abc:my-secret');

    expect(identity).toEqual({
      id: 'acc_1',
      roles: ['api'],
      metadata: { clientId: 'cli_abc' },
    });
  });

  it('resolves with the secondary secret', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    const identity = await adapter.resolve('cli_abc:backup-secret');
    expect(identity).not.toBeNull();
    expect(identity!.id).toBe('acc_1');
  });

  it('returns null for wrong secret', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    expect(await adapter.resolve('cli_abc:wrong')).toBeNull();
  });

  it('returns null for unknown client ID', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    expect(await adapter.resolve('unknown:secret')).toBeNull();
  });

  it('returns null for non-string token', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    expect(await adapter.resolve(null)).toBeNull();
    expect(await adapter.resolve(undefined)).toBeNull();
    expect(await adapter.resolve(12345)).toBeNull();
  });

  it('returns null for token without separator', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    expect(await adapter.resolve('no-separator')).toBeNull();
  });

  it('returns null for empty clientId or secret', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    expect(await adapter.resolve(':secret')).toBeNull();
    expect(await adapter.resolve('clientId:')).toBeNull();
  });

  it('uses custom mapRoles', async () => {
    const adapter = createApiKeyAuthAdapter({
      store: keyStore,
      mapRoles: () => ['admin', 'api'],
    });

    const identity = await adapter.resolve('cli_abc:my-secret');
    expect(identity!.roles).toEqual(['admin', 'api']);
  });
});
