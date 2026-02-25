import { describe, it, expect } from 'vitest';
import { hasRole, isOwner, and, or, not } from '../src/guards.js';
import type { Identity } from '../src/types.js';

const admin: Identity = { id: 'user-1', roles: ['admin'] };
const editor: Identity = { id: 'user-2', roles: ['editor'] };
const viewer: Identity = { id: 'user-3', roles: ['viewer'] };
const noRoles: Identity = { id: 'user-4', roles: [] };

describe('hasRole', () => {
  it('passes when identity has the role', () => {
    expect(hasRole('admin')(admin)).toBe(true);
  });

  it('fails when identity lacks the role', () => {
    expect(hasRole('admin')(editor)).toBe(false);
  });

  it('passes when identity has any of the specified roles', () => {
    expect(hasRole('admin', 'editor')(editor)).toBe(true);
  });

  it('fails when identity has none of the specified roles', () => {
    expect(hasRole('admin', 'editor')(viewer)).toBe(false);
  });

  it('fails for identity with empty roles', () => {
    expect(hasRole('admin')(noRoles)).toBe(false);
  });
});

describe('isOwner', () => {
  it('passes when identity.id matches context ownerId', () => {
    expect(isOwner()(admin, { ownerId: 'user-1' })).toBe(true);
  });

  it('fails when identity.id does not match', () => {
    expect(isOwner()(admin, { ownerId: 'user-2' })).toBe(false);
  });

  it('fails when context is missing', () => {
    expect(isOwner()(admin)).toBe(false);
  });

  it('uses a custom owner field', () => {
    expect(isOwner('createdBy')(admin, { createdBy: 'user-1' })).toBe(true);
    expect(isOwner('createdBy')(admin, { createdBy: 'user-2' })).toBe(false);
  });
});

describe('and', () => {
  it('passes when all guards pass', () => {
    const guard = and(hasRole('admin'), isOwner());
    expect(guard(admin, { ownerId: 'user-1' })).toBe(true);
  });

  it('fails when any guard fails', () => {
    const guard = and(hasRole('admin'), isOwner());
    expect(guard(admin, { ownerId: 'user-2' })).toBe(false);
  });
});

describe('or', () => {
  it('passes when any guard passes', () => {
    const guard = or(hasRole('admin'), hasRole('editor'));
    expect(guard(editor)).toBe(true);
  });

  it('fails when all guards fail', () => {
    const guard = or(hasRole('admin'), hasRole('editor'));
    expect(guard(viewer)).toBe(false);
  });
});

describe('not', () => {
  it('inverts a passing guard', () => {
    expect(not(hasRole('admin'))(admin)).toBe(false);
  });

  it('inverts a failing guard', () => {
    expect(not(hasRole('admin'))(editor)).toBe(true);
  });
});

describe('composition', () => {
  it('composes nested guards', () => {
    // (admin OR editor) AND owner
    const guard = and(or(hasRole('admin'), hasRole('editor')), isOwner());

    expect(guard(admin, { ownerId: 'user-1' })).toBe(true);
    expect(guard(editor, { ownerId: 'user-2' })).toBe(true);
    expect(guard(viewer, { ownerId: 'user-3' })).toBe(false);
    expect(guard(admin, { ownerId: 'someone-else' })).toBe(false);
  });

  it('handles not(or(...))', () => {
    const guard = not(or(hasRole('admin'), hasRole('editor')));
    expect(guard(admin)).toBe(false);
    expect(guard(viewer)).toBe(true);
  });
});
