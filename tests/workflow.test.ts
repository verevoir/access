import { describe, it, expect } from 'vitest';
import { defineWorkflow } from '../src/workflow.js';
import { hasRole, or } from '../src/guards.js';
import type { Identity } from '../src/types.js';

const admin: Identity = { id: 'user-1', roles: ['admin'] };
const editor: Identity = { id: 'user-2', roles: ['editor'] };
const author: Identity = { id: 'user-3', roles: ['author'] };
const viewer: Identity = { id: 'user-4', roles: ['viewer'] };

const publishing = defineWorkflow({
  name: 'publishing',
  states: ['draft', 'review', 'published', 'archived'],
  initial: 'draft',
  transitions: [
    {
      from: 'draft',
      to: 'review',
      guard: or(hasRole('author'), hasRole('editor')),
    },
    { from: 'review', to: 'published', guard: hasRole('editor') },
    { from: 'published', to: 'archived', guard: hasRole('admin') },
    { from: 'review', to: 'draft' }, // no guard — anyone can send back to draft
  ],
});

describe('defineWorkflow', () => {
  it('stores configuration', () => {
    expect(publishing.name).toBe('publishing');
    expect(publishing.states).toEqual([
      'draft',
      'review',
      'published',
      'archived',
    ]);
    expect(publishing.initial).toBe('draft');
    expect(publishing.transitions).toHaveLength(4);
  });

  it('throws on empty states', () => {
    expect(() =>
      defineWorkflow({
        name: 'bad',
        states: [],
        initial: 'x',
        transitions: [],
      }),
    ).toThrow('at least one state');
  });

  it('throws when initial state is not in states', () => {
    expect(() =>
      defineWorkflow({
        name: 'bad',
        states: ['a', 'b'],
        initial: 'c',
        transitions: [],
      }),
    ).toThrow('Initial state "c"');
  });

  it('throws when transition references unknown from state', () => {
    expect(() =>
      defineWorkflow({
        name: 'bad',
        states: ['a', 'b'],
        initial: 'a',
        transitions: [{ from: 'x', to: 'b' }],
      }),
    ).toThrow('from "x"');
  });

  it('throws when transition references unknown to state', () => {
    expect(() =>
      defineWorkflow({
        name: 'bad',
        states: ['a', 'b'],
        initial: 'a',
        transitions: [{ from: 'a', to: 'x' }],
      }),
    ).toThrow('to "x"');
  });
});

describe('availableTransitions', () => {
  it('returns transitions from current state that pass guards', () => {
    const transitions = publishing.availableTransitions('draft', author);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe('review');
  });

  it('returns no transitions when guard blocks all', () => {
    const transitions = publishing.availableTransitions('draft', viewer);
    expect(transitions).toHaveLength(0);
  });

  it('includes unguarded transitions for any identity', () => {
    const transitions = publishing.availableTransitions('review', viewer);
    // viewer can send back to draft (unguarded) but not publish
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe('draft');
  });

  it('returns multiple available transitions for editor in review', () => {
    const transitions = publishing.availableTransitions('review', editor);
    expect(transitions).toHaveLength(2);
    const targets = transitions.map((t) => t.to);
    expect(targets).toContain('published');
    expect(targets).toContain('draft');
  });

  it('returns empty for a state with no outgoing transitions', () => {
    const transitions = publishing.availableTransitions('archived', admin);
    expect(transitions).toHaveLength(0);
  });
});

describe('canTransition', () => {
  it('allows valid guarded transition', () => {
    expect(publishing.canTransition('draft', 'review', author)).toBe(true);
  });

  it('denies guarded transition when guard fails', () => {
    expect(publishing.canTransition('draft', 'review', viewer)).toBe(false);
  });

  it('allows unguarded transition', () => {
    expect(publishing.canTransition('review', 'draft', viewer)).toBe(true);
  });

  it('denies non-existent transition', () => {
    expect(publishing.canTransition('draft', 'published', admin)).toBe(false);
  });

  it('denies transition from wrong state', () => {
    expect(publishing.canTransition('published', 'review', admin)).toBe(false);
  });
});

describe('full lifecycle', () => {
  it('moves content through draft → review → published → archived', () => {
    let state = publishing.initial;
    expect(state).toBe('draft');

    // Author submits for review
    expect(publishing.canTransition(state, 'review', author)).toBe(true);
    state = 'review';

    // Editor publishes
    expect(publishing.canTransition(state, 'published', editor)).toBe(true);
    state = 'published';

    // Admin archives
    expect(publishing.canTransition(state, 'archived', admin)).toBe(true);
    state = 'archived';

    // No further transitions
    expect(publishing.availableTransitions(state, admin)).toHaveLength(0);
  });

  it('allows review → draft rejection by anyone', () => {
    const state = 'review';
    // Even a viewer can send back to draft
    expect(publishing.canTransition(state, 'draft', viewer)).toBe(true);
  });
});

describe('integration: all modules together', () => {
  it('composes auth, policy, guards, and workflow', async () => {
    // Simulate resolving a token
    const { defineAuthAdapter } = await import('../src/auth.js');
    const { definePolicy, can } = await import('../src/policy.js');

    const auth = defineAuthAdapter({
      resolve: async (token) => {
        if (token === 'editor-jwt') return { id: 'user-2', roles: ['editor'] };
        if (token === 'viewer-jwt') return { id: 'user-4', roles: ['viewer'] };
        return null;
      },
    });

    const policy = definePolicy({
      rules: [
        { role: 'editor', actions: ['create', 'read', 'update'] },
        { role: 'viewer', actions: ['read'] },
      ],
    });

    // Resolve identities
    const editorIdentity = await auth.resolve('editor-jwt');
    const viewerIdentity = await auth.resolve('viewer-jwt');
    expect(editorIdentity).not.toBeNull();
    expect(viewerIdentity).not.toBeNull();

    // Policy checks
    expect(can(policy, editorIdentity!, 'update')).toBe(true);
    expect(can(policy, viewerIdentity!, 'update')).toBe(false);

    // Workflow checks
    expect(publishing.canTransition('draft', 'review', editorIdentity!)).toBe(
      true,
    );
    expect(publishing.canTransition('draft', 'review', viewerIdentity!)).toBe(
      false,
    );
  });
});
