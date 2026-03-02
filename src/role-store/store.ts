import type { RoleStore } from '../types.js';

/** Structural type — only the methods createRoleStore actually uses. No import from @nextlake/storage. */
interface StorageAdapter {
  create(
    blockType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  list(
    blockType: string,
    options?: { where?: Record<string, unknown> },
  ): Promise<{ id: string; data: Record<string, unknown> }[]>;
  update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  delete(id: string): Promise<void>;
}

export interface RoleStoreOptions {
  storage: StorageAdapter;
  seedAdmin?: {
    userId: string;
    roles: string[];
  };
}

const BLOCK_TYPE = 'role-assignment';

export function createRoleStore(options: RoleStoreOptions): RoleStore {
  const { storage, seedAdmin } = options;
  let seeded = false;

  async function findByUserId(
    userId: string,
  ): Promise<{ id: string; data: Record<string, unknown> } | null> {
    const docs = await storage.list(BLOCK_TYPE, {
      where: { userId },
    });
    return docs[0] ?? null;
  }

  async function trySeed(userId: string): Promise<string[] | null> {
    if (seeded || !seedAdmin || seedAdmin.userId !== userId) return null;
    seeded = true;

    const all = await storage.list(BLOCK_TYPE);
    if (all.length > 0) return null;

    await storage.create(BLOCK_TYPE, {
      userId: seedAdmin.userId,
      roles: seedAdmin.roles,
    });
    return seedAdmin.roles;
  }

  return {
    async getRoles(userId: string): Promise<string[]> {
      const doc = await findByUserId(userId);
      if (doc) return doc.data.roles as string[];

      const seededRoles = await trySeed(userId);
      if (seededRoles) return seededRoles;

      return [];
    },

    async setRoles(userId: string, roles: string[]): Promise<void> {
      const existing = await findByUserId(userId);
      if (existing) {
        await storage.update(existing.id, { userId, roles });
      } else {
        await storage.create(BLOCK_TYPE, { userId, roles });
      }
    },

    async listAssignments(): Promise<{ userId: string; roles: string[] }[]> {
      const docs = await storage.list(BLOCK_TYPE);
      return docs.map((doc) => ({
        userId: doc.data.userId as string,
        roles: doc.data.roles as string[],
      }));
    },
  };
}
