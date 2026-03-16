import type { ApiKey, SecretInfo, StorageAdapter } from './types.js';

const BLOCK_TYPE = 'api-key';

export interface ApiKeyStoreOptions {
  storage: StorageAdapter;
  /**
   * Hash a raw secret into a storage-safe value.
   * Consumer provides the hashing strategy (e.g. SHA-256, bcrypt).
   */
  hashSecret: (raw: string) => string | Promise<string>;
  /**
   * Compare a raw secret against a stored hash.
   * Consumer provides the comparison strategy.
   */
  verifySecret: (raw: string, hash: string) => boolean | Promise<boolean>;
}

export interface ApiKeyStore {
  /** Create a new API key. Returns the key with raw secrets (only time they're available). */
  create(
    clientId: string,
    accountId: string,
    primarySecret: string,
    secondarySecret: string,
    createdBy: string,
  ): Promise<ApiKey>;

  /** Look up an API key by client ID. Returns null if not found. */
  getByClientId(clientId: string): Promise<ApiKey | null>;

  /** Verify a client ID + secret pair. Returns the API key if valid, null otherwise. */
  verify(clientId: string, secret: string): Promise<ApiKey | null>;

  /** Rotate the primary secret. Returns the updated key (with new hash, not raw). */
  rotatePrimary(
    clientId: string,
    newSecret: string,
    rotatedBy: string,
  ): Promise<ApiKey>;

  /** Rotate the secondary secret. Returns the updated key (with new hash, not raw). */
  rotateSecondary(
    clientId: string,
    newSecret: string,
    rotatedBy: string,
  ): Promise<ApiKey>;

  /** List all API keys for an account. */
  listByAccount(accountId: string): Promise<ApiKey[]>;

  /** Revoke (delete) an API key. */
  revoke(clientId: string): Promise<void>;
}

export function createApiKeyStore(options: ApiKeyStoreOptions): ApiKeyStore {
  const { storage, hashSecret, verifySecret } = options;

  async function findByClientId(
    clientId: string,
  ): Promise<{ id: string; data: Record<string, unknown> } | null> {
    const docs = await storage.list(BLOCK_TYPE, {
      where: { clientId },
    });
    return docs[0] ?? null;
  }

  function toApiKey(doc: {
    data: Record<string, unknown>;
  }): ApiKey {
    return {
      clientId: doc.data.clientId as string,
      accountId: doc.data.accountId as string,
      primary: doc.data.primary as SecretInfo,
      secondary: doc.data.secondary as SecretInfo,
      createdAt: doc.data.createdAt as number,
      createdBy: doc.data.createdBy as string,
    };
  }

  return {
    async create(clientId, accountId, primarySecret, secondarySecret, createdBy) {
      const now = Math.floor(Date.now() / 1000);
      const primaryHash = await hashSecret(primarySecret);
      const secondaryHash = await hashSecret(secondarySecret);

      const primary: SecretInfo = { hash: primaryHash, createdAt: now, createdBy };
      const secondary: SecretInfo = { hash: secondaryHash, createdAt: now, createdBy };

      await storage.create(BLOCK_TYPE, {
        clientId,
        accountId,
        primary,
        secondary,
        createdAt: now,
        createdBy,
      });

      return { clientId, accountId, primary, secondary, createdAt: now, createdBy };
    },

    async getByClientId(clientId) {
      const doc = await findByClientId(clientId);
      if (!doc) return null;
      return toApiKey(doc);
    },

    async verify(clientId, secret) {
      const doc = await findByClientId(clientId);
      if (!doc) return null;

      const key = toApiKey(doc);
      const primaryMatch = await verifySecret(secret, key.primary.hash);
      if (primaryMatch) return key;

      const secondaryMatch = await verifySecret(secret, key.secondary.hash);
      if (secondaryMatch) return key;

      return null;
    },

    async rotatePrimary(clientId, newSecret, rotatedBy) {
      const doc = await findByClientId(clientId);
      if (!doc) throw new Error(`API key ${clientId} not found`);

      const now = Math.floor(Date.now() / 1000);
      const newHash = await hashSecret(newSecret);
      const newPrimary: SecretInfo = { hash: newHash, createdAt: now, createdBy: rotatedBy };

      const updated = await storage.update(doc.id, {
        ...doc.data,
        primary: newPrimary,
      });
      return toApiKey(updated);
    },

    async rotateSecondary(clientId, newSecret, rotatedBy) {
      const doc = await findByClientId(clientId);
      if (!doc) throw new Error(`API key ${clientId} not found`);

      const now = Math.floor(Date.now() / 1000);
      const newHash = await hashSecret(newSecret);
      const newSecondary: SecretInfo = { hash: newHash, createdAt: now, createdBy: rotatedBy };

      const updated = await storage.update(doc.id, {
        ...doc.data,
        secondary: newSecondary,
      });
      return toApiKey(updated);
    },

    async listByAccount(accountId) {
      const docs = await storage.list(BLOCK_TYPE, {
        where: { accountId },
      });
      return docs.map(toApiKey);
    },

    async revoke(clientId) {
      const doc = await findByClientId(clientId);
      if (!doc) return;
      await storage.delete(doc.id);
    },
  };
}
