import type {
  Identity,
  Transition,
  Workflow,
  WorkflowConfig,
} from './types.js';

/** Create a stateless workflow evaluator from a configuration. */
export function defineWorkflow(config: WorkflowConfig): Workflow {
  const { name, states, initial, transitions } = config;

  // Validate states
  if (states.length === 0) {
    throw new Error('Workflow must have at least one state.');
  }
  if (!states.includes(initial)) {
    throw new Error(
      `Initial state "${initial}" is not in the states list: [${states.join(', ')}].`,
    );
  }

  // Validate transitions reference valid states
  for (const t of transitions) {
    if (!states.includes(t.from)) {
      throw new Error(
        `Transition from "${t.from}" references unknown state. Valid states: [${states.join(', ')}].`,
      );
    }
    if (!states.includes(t.to)) {
      throw new Error(
        `Transition to "${t.to}" references unknown state. Valid states: [${states.join(', ')}].`,
      );
    }
  }

  return {
    name,
    states,
    initial,
    transitions,

    availableTransitions(
      currentState: string,
      identity: Identity,
      context?: Record<string, unknown>,
    ): Transition[] {
      return transitions.filter((t) => {
        if (t.from !== currentState) return false;
        if (t.guard && !t.guard(identity, context)) return false;
        return true;
      });
    },

    canTransition(
      currentState: string,
      to: string,
      identity: Identity,
      context?: Record<string, unknown>,
    ): boolean {
      return transitions.some((t) => {
        if (t.from !== currentState || t.to !== to) return false;
        if (t.guard && !t.guard(identity, context)) return false;
        return true;
      });
    },
  };
}
