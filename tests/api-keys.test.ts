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
          const match = Object.entries(options.where).every(([k, v]) =>
            k === 'id' ? doc.id === v : doc.data[k] === v,
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

  it('creates a key with a single primary secret and provenance', async () => {
    const key = await store.create('cli_abc', 'acc_1', 'my-secret', 'admin');

    expect(key.clientId).toBe('cli_abc');
    expect(key.accountId).toBe('acc_1');
    expect(key.primary.hash).toBe('hashed:my-secret');
    expect(key.primary.createdBy).toBe('admin');
    expect(key.secondary).toBeUndefined();
    expect(key.createdAt).toBeGreaterThan(0);
  });

  it('retrieves a key by client ID', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 'admin');
    const found = await store.getByClientId('cli_abc');
    expect(found).not.toBeNull();
    expect(found!.clientId).toBe('cli_abc');
  });

  it('returns null for unknown client ID', async () => {
    expect(await store.getByClientId('nonexistent')).toBeNull();
  });

  it('verifies against the primary secret', async () => {
    await store.create('cli_abc', 'acc_1', 'my-secret', 'admin');
    const key = await store.verify('cli_abc', 'my-secret');
    expect(key).not.toBeNull();
    expect(key!.clientId).toBe('cli_abc');
  });

  it('returns null for wrong secret', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 'admin');
    expect(await store.verify('cli_abc', 'wrong')).toBeNull();
  });

  it('returns null for unknown client ID on verify', async () => {
    expect(await store.verify('nonexistent', 'any')).toBeNull();
  });

  describe('rotate', () => {
    it('promotes new secret to primary and demotes old primary to secondary', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      const rotated = await store.rotate('cli_abc', 'new-secret', 'ops');

      expect(rotated.primary.hash).toBe('hashed:new-secret');
      expect(rotated.primary.createdBy).toBe('ops');
      expect(rotated.secondary).toBeDefined();
      expect(rotated.secondary!.hash).toBe('hashed:original');
      expect(rotated.secondary!.createdBy).toBe('admin');
    });

    it('new primary verifies after rotation', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      await store.rotate('cli_abc', 'new-secret', 'ops');

      expect(await store.verify('cli_abc', 'new-secret')).not.toBeNull();
    });

    it('old primary (now secondary) still verifies after rotation', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      await store.rotate('cli_abc', 'new-secret', 'ops');

      expect(await store.verify('cli_abc', 'original')).not.toBeNull();
    });

    it('rotating again replaces the secondary with the previous primary', async () => {
      await store.create('cli_abc', 'acc_1', 'v1', 'admin');
      await store.rotate('cli_abc', 'v2', 'ops');
      const rotated = await store.rotate('cli_abc', 'v3', 'ops');

      expect(rotated.primary.hash).toBe('hashed:v3');
      expect(rotated.secondary!.hash).toBe('hashed:v2');

      // v1 is gone
      expect(await store.verify('cli_abc', 'v1')).toBeNull();
      // v2 and v3 work
      expect(await store.verify('cli_abc', 'v2')).not.toBeNull();
      expect(await store.verify('cli_abc', 'v3')).not.toBeNull();
    });

    it('throws when rotating a nonexistent key', async () => {
      await expect(store.rotate('nonexistent', 'x', 'admin')).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('dropSecondary', () => {
    it('removes the secondary secret', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      await store.rotate('cli_abc', 'new-secret', 'ops');
      const dropped = await store.dropSecondary('cli_abc');

      expect(dropped.primary.hash).toBe('hashed:new-secret');
      expect(dropped.secondary).toBeUndefined();
    });

    it('old primary no longer verifies after drop', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      await store.rotate('cli_abc', 'new-secret', 'ops');
      await store.dropSecondary('cli_abc');

      expect(await store.verify('cli_abc', 'original')).toBeNull();
      expect(await store.verify('cli_abc', 'new-secret')).not.toBeNull();
    });

    it('is safe to call when there is no secondary', async () => {
      await store.create('cli_abc', 'acc_1', 'original', 'admin');
      const dropped = await store.dropSecondary('cli_abc');
      expect(dropped.secondary).toBeUndefined();
    });

    it('throws for nonexistent key', async () => {
      await expect(store.dropSecondary('nonexistent')).rejects.toThrow(
        'not found',
      );
    });
  });

  it('lists keys by account', async () => {
    await store.create('cli_1', 'acc_1', 'p', 'admin');
    await store.create('cli_2', 'acc_1', 'p', 'admin');
    await store.create('cli_3', 'acc_2', 'p', 'admin');

    const keys = await store.listByAccount('acc_1');
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.clientId).sort()).toEqual(['cli_1', 'cli_2']);
  });

  it('revokes a key', async () => {
    await store.create('cli_abc', 'acc_1', 'p', 'admin');
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
    await keyStore.create('cli_abc', 'acc_1', 'my-secret', 'admin');
  });

  it('resolves a valid clientId:secret to an Identity with namespaced id + accountId in metadata', async () => {
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    const identity = await adapter.resolve('cli_abc:my-secret');

    expect(identity).toEqual({
      id: 'apikey:cli_abc',
      roles: ['api'],
      metadata: { clientId: 'cli_abc', accountId: 'acc_1' },
    });
  });

  it('resolves with the secondary secret after rotation', async () => {
    await keyStore.rotate('cli_abc', 'new-secret', 'ops');
    const adapter = createApiKeyAuthAdapter({ store: keyStore });
    const identity = await adapter.resolve('cli_abc:my-secret');
    expect(identity).not.toBeNull();
    expect(identity!.id).toBe('apikey:cli_abc');
    expect(identity!.metadata).toMatchObject({ accountId: 'acc_1' });
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
