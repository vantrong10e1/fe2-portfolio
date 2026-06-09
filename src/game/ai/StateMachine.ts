/**
 * StateMachine - Generic finite state machine for entity behaviour.
 *
 * Architecture Decision:
 * A data-driven FSM keeps entity logic organised and testable.  States are
 * plain objects that implement IState, making it trivial to add / remove
 * behaviours.  The machine supports optional transition guards so callers
 * can enforce rules like "can't dash while attacking".
 *
 * Generics:
 *   TContext - the entity or object that owns this state machine, passed
 *             into every state callback so states can mutate the owner.
 */

// ── Interfaces ─────────────────────────────────────────────────────────

/**
 * A single state in the FSM.
 * Each method receives the owning context so states stay decoupled from
 * the machine itself.
 */
export interface IState<TContext> {
  /** Unique name used as the dictionary key */
  readonly name: string;

  /** Called once when entering this state */
  enter(context: TContext): void;

  /** Called every frame while this state is active */
  update(context: TContext, dt: number): void;

  /** Called once when leaving this state */
  exit(context: TContext): void;
}

/**
 * Optional guard evaluated before a transition is allowed.
 * Return `true` to permit the transition, `false` to block it.
 */
export type TransitionGuard<TContext> = (
  context: TContext,
  from: string,
  to: string,
) => boolean;

// ── StateMachine ───────────────────────────────────────────────────────

export class StateMachine<TContext> {
  /** Map of state-name → state instance */
  private states = new Map<string, IState<TContext>>();

  /** Currently active state (null until first setState call) */
  private currentState: IState<TContext> | null = null;

  /** The state that was active before the current one */
  private previousState: IState<TContext> | null = null;

  /** Optional guard invoked before every transition */
  private guard: TransitionGuard<TContext> | null = null;

  /** The entity / object that owns this machine */
  private context: TContext;

  constructor(context: TContext) {
    this.context = context;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Register a state. Chainable. */
  addState(state: IState<TContext>): this {
    this.states.set(state.name, state);
    return this;
  }

  /** Set an optional global transition guard. Chainable. */
  setGuard(guard: TransitionGuard<TContext>): this {
    this.guard = guard;
    return this;
  }

  /**
   * Transition to a new state by name.
   * If a guard is set and returns false the transition is silently skipped.
   */
  setState(name: string): void {
    const next = this.states.get(name);
    if (!next) {
      console.warn(`[StateMachine] Unknown state: "${name}"`);
      return;
    }

    // Don't re-enter the same state
    if (this.currentState === next) return;

    // Evaluate guard
    const from = this.currentState?.name ?? '';
    if (this.guard && !this.guard(this.context, from, name)) return;

    // Exit → swap → enter
    this.currentState?.exit(this.context);
    this.previousState = this.currentState;
    this.currentState = next;
    this.currentState.enter(this.context);
  }

  /** Tick the active state. Call from the owner's update(). */
  update(dt: number): void {
    this.currentState?.update(this.context, dt);
  }

  // ── Getters ────────────────────────────────────────────────────────

  /** Name of the currently active state, or empty string */
  get currentStateName(): string {
    return this.currentState?.name ?? '';
  }

  /** Name of the previous state, or empty string */
  get previousStateName(): string {
    return this.previousState?.name ?? '';
  }

  /** Whether the machine has been initialised with a state */
  get isActive(): boolean {
    return this.currentState !== null;
  }
}
