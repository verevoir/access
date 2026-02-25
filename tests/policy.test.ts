import { describe, it, expect } from 'vitest';
import { definePolicy, can } from '../src/policy.js';
import type { Identity } from '../src/types.js';

const policy = definePolicy({
  rules: [
    { role: 'admin', actions: ['create', 'read', 'update', 'delete'] },
    { role: 'editor', actions: ['create', 'read', 'update'] },
    { role: 'author', actions: ['create', 'read', 'update'], scope: 'own' },
    { role: 'viewer', actions: ['read'] },
  ],
});

const admin: Identity = { id: 'user-1', roles: ['admin'] };
const editor: Identity = { id: 'user-2', roles: ['editor'] };
const author: Identity = { id: 'user-3', roles: ['author'] };
const viewer: Identity = { id: 'user-4', roles: ['viewer'] };
const noRoles: Identity = { id: 'user-5', roles: [] };

describe('definePolicy', () => {
  it('stores the rules', () => {
    expect(policy.rules).toHaveLength(4);
  });
});

describe('policy.can (method)', () => {
  it('allows admin to do everything', () => {
    expect(policy.can(admin, 'create')).toBe(true);
    expect(policy.can(admin, 'read')).toBe(true);
    expect(policy.can(admin, 'update')).toBe(true);
    expect(policy.can(admin, 'delete')).toBe(true);
  });

  it('allows editor to create, read, update but not delete', () => {
    expect(policy.can(editor, 'create')).toBe(true);
    expect(policy.can(editor, 'read')).toBe(true);
    expect(policy.can(editor, 'update')).toBe(true);
    expect(policy.can(editor, 'delete')).toBe(false);
  });

  it('allows viewer to read only', () => {
    expect(policy.can(viewer, 'read')).toBe(true);
    expect(policy.can(viewer, 'create')).toBe(false);
    expect(policy.can(viewer, 'update')).toBe(false);
    expect(policy.can(viewer, 'delete')).toBe(false);
  });

  it('denies by default (no matching role)', () => {
    expect(policy.can(noRoles, 'read')).toBe(false);
  });

  it('denies unknown actions', () => {
    expect(policy.can(admin, 'publish')).toBe(false);
  });
});

describe('scope: own', () => {
  it('allows author to update own documents', () => {
    expect(policy.can(author, 'update', { ownerId: 'user-3' })).toBe(true);
  });

  it('denies author from updating others documents', () => {
    expect(policy.can(author, 'update', { ownerId: 'user-1' })).toBe(false);
  });

  it('denies author when no context is provided', () => {
    expect(policy.can(author, 'update')).toBe(false);
  });

  it('denies author from deleting even own documents', () => {
    expect(policy.can(author, 'delete', { ownerId: 'user-3' })).toBe(false);
  });
});

describe('can (standalone function)', () => {
  it('works identically to the method', () => {
    expect(can(policy, admin, 'delete')).toBe(true);
    expect(can(policy, viewer, 'delete')).toBe(false);
    expect(can(policy, author, 'update', { ownerId: 'user-3' })).toBe(true);
  });
});

describe('multi-role identity', () => {
  it('grants the union of permissions', () => {
    const editorAuthor: Identity = {
      id: 'user-6',
      roles: ['editor', 'author'],
    };
    // editor allows update on all, so no ownership check needed
    expect(policy.can(editorAuthor, 'update')).toBe(true);
    expect(policy.can(editorAuthor, 'create')).toBe(true);
    // neither role allows delete
    expect(policy.can(editorAuthor, 'delete')).toBe(false);
  });
});
