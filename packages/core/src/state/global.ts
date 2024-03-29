import { IReactionAdmin } from "../types";

const OVERFLOW = 10_000_000;

interface GlobalState {
  /**
   * Counter tracking total number of actions running. This is used to know when it's safe
   * to start calculating the pending reactions list.
   */
  batchedActionsCount: number;
  /**
   * Flag that identifies whether an error was thrown inside of an action or not.
   * TODO: can this be tracked in a non global way? or is it even needed at all?
   */
  actionThrew: boolean;
  /**
   * Indicates whether the pending reactions are being calculated or not.
   */
  isRunningReactions: boolean;
  /**
   * Identifies the outermost action that is running, and null when no action is running. This
   * information allows computed values to cache themselves if accessed multiple times within a
   * single action.
   * TODO: can this computed value caching happen without the use of a global variable?
   */
  currentlyRunningAction: null | number;
  /**
   * The currently running reaction, critical to help construct the dependency graph. When an
   * observable value is accessed it uses this to link itself to the reaction.
   */
  reactionContext: IReactionAdmin | null;
  /**
   * The list of reactions to run upon all active transactions completing.
   */
  pendingReactions: IReactionAdmin[];
  /**
   * Get's the next "unique" incremented value. In this case, we're not needing true uniqueness,
   * just something that produces an ID quickly without running into MIN/MAX_SAFE_INTEGER issues.
   *
   * The following were tried and abandoned.
   * 1. Date.now() -- insufficient as 2 calls to function could result in same value if within the same millisecond
   * 2. performance.now() -- worst performance of "valid" options
   * 3. if(id === Number.MAX_SAFE_INTEGER) {id = Number.MIN_SAFE_INTEGER} -- this was surprisingly slow.
   *
   * The modulo solution was the best performing and the overflow limit of 1 million makes any
   * theoretical duplicate value so unlikely. Plus the worst that happens if a duplicate is met would be
   * something re-calculating one time more than it should.
   *
   * @returns the next "unique" number
   */
  getNextId: () => number;
}

export const $fobx = Symbol.for("fobx-administration");

export function getGlobalState(): GlobalState {
  // @ts-expect-error - global def doesn't know about $fobx symbol
  if (globalThis[$fobx] !== undefined) return globalThis[$fobx];

  let id = 0;

  const state: GlobalState = {
    batchedActionsCount: 0,
    actionThrew: false,
    isRunningReactions: false,
    currentlyRunningAction: null as null | number,
    reactionContext: null as IReactionAdmin | null,
    pendingReactions: [] as IReactionAdmin[],
    getNextId: () => {
      id++;
      return id % OVERFLOW;
    },
  };

  Object.defineProperty(globalThis, $fobx, {
    value: state,
  });

  return state;
}
