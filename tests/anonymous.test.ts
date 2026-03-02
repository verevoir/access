import { describe, it, expect } from 'vitest';
import { ANONYMOUS, isAnonymous } from '../src/anonymous.js';
import { definePolicy } from '../src/policy.js';
import { defineWorkflow } from '../src/workflow.js';
import { hasRole, or } from '../src/guards.js';

describe('ANONYMOUS', () => {
  it('has id "anonymous"', () => {
    expect(ANONYMOUS.id).toBe('anonymous');
  });

  it('has roles ["viewer"]', () => {
    expect(ANONYMOUS.roles).toEqual(['viewer']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ANONYMOUS)).toBe(true);
  });
});

describe('isAnonymous', () => {
  it('returns true for the ANONYMOUS constant', () => {
    expect(isAnonymous(ANONYMOUS)).toBe(true);
  });

  it('works structurally (not by reference)', () => {
    const copy = { id: 'anonymous', roles: ['viewer'] };
    expect(isAnonymous(copy)).toBe(true);
  });

  it('returns false for a named identity', () => {
    expect(isAnonymous({ id: 'user-1', roles: ['admin'] })).toBe(false);
  });
});

describe('ANONYMOUS with policy', () => {
  const policy = definePolicy({
    rules: [
      { role: 'admin', actions: ['create', 'read', 'update', 'delete'] },
      { role: 'viewer', actions: ['read'] },
    ],
  });

  it('can read', () => {
    expect(policy.can(ANONYMOUS, 'read')).toBe(true);
  });

  it('cannot create', () => {
    expect(policy.can(ANONYMOUS, 'create')).toBe(false);
  });

  it('cannot update', () => {
    expect(policy.can(ANONYMOUS, 'update')).toBe(false);
  });

  it('cannot delete', () => {
    expect(policy.can(ANONYMOUS, 'delete')).toBe(false);
  });
});

describe('ANONYMOUS with workflow', () => {
  const publishing = defineWorkflow({
    name: 'publishing',
    states: ['draft', 'review', 'published'],
    initial: 'draft',
    transitions: [
      {
        from: 'draft',
        to: 'review',
        guard: or(hasRole('author'), hasRole('editor')),
      },
      { from: 'review', to: 'published', guard: hasRole('editor') },
    ],
  });

  it('has no available transitions from any state', () => {
    expect(publishing.availableTransitions('draft', ANONYMOUS)).toEqual([]);
    expect(publishing.availableTransitions('review', ANONYMOUS)).toEqual([]);
    expect(publishing.availableTransitions('published', ANONYMOUS)).toEqual([]);
  });
});
