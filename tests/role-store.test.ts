import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '@nextlake/storage';
import { createRoleStore } from '../src/role-store/store.js';

describe('createRoleStore', () => {
  let storage: MemoryAdapter;

  beforeEach(async () => {
    storage = new MemoryAdapter();
    await storage.connect();
  });

  it('getRoles returns [] for unknown user', async () => {
    const store = createRoleStore({ storage });
    expect(await store.getRoles('unknown-user')).toEqual([]);
  });

  it('setRoles + getRoles round-trip', async () => {
    const store = createRoleStore({ storage });
    await store.setRoles('user-1', ['admin', 'editor']);
    expect(await store.getRoles('user-1')).toEqual(['admin', 'editor']);
  });

  it('setRoles overwrites existing assignment', async () => {
    const store = createRoleStore({ storage });
    await store.setRoles('user-1', ['admin']);
    await store.setRoles('user-1', ['viewer']);
    expect(await store.getRoles('user-1')).toEqual(['viewer']);
  });

  it('listAssignments returns all entries', async () => {
    const store = createRoleStore({ storage });
    await store.setRoles('user-1', ['admin']);
    await store.setRoles('user-2', ['editor']);
    const assignments = await store.listAssignments();
    expect(assignments).toHaveLength(2);
    expect(assignments).toContainEqual({
      userId: 'user-1',
      roles: ['admin'],
    });
    expect(assignments).toContainEqual({
      userId: 'user-2',
      roles: ['editor'],
    });
  });

  it('seed admin creates assignment on first matching getRoles with empty store', async () => {
    const store = createRoleStore({
      storage,
      seedAdmin: { userId: 'admin-1', roles: ['admin'] },
    });

    const roles = await store.getRoles('admin-1');
    expect(roles).toEqual(['admin']);

    // Verify it persisted
    const assignments = await store.listAssignments();
    expect(assignments).toEqual([{ userId: 'admin-1', roles: ['admin'] }]);
  });

  it('seed does not fire for non-matching userId', async () => {
    const store = createRoleStore({
      storage,
      seedAdmin: { userId: 'admin-1', roles: ['admin'] },
    });

    const roles = await store.getRoles('other-user');
    expect(roles).toEqual([]);

    // Store should still be empty
    const assignments = await store.listAssignments();
    expect(assignments).toHaveLength(0);
  });

  it('seed does not fire if store already has entries', async () => {
    const store = createRoleStore({
      storage,
      seedAdmin: { userId: 'admin-1', roles: ['admin'] },
    });

    // Pre-populate the store
    await store.setRoles('user-1', ['editor']);

    // Now request the seed admin's roles — should not seed
    const roles = await store.getRoles('admin-1');
    expect(roles).toEqual([]);

    const assignments = await store.listAssignments();
    expect(assignments).toHaveLength(1);
    expect(assignments[0].userId).toBe('user-1');
  });
});
