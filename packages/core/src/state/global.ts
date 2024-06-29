import type { IReactionAdmin } from "../reactions/reaction";

const OVERFLOW = 10_000_000;

interface GlobalState {
  /**
   * Counter tracking total number of actions running. This is used to know when it's safe
   * to start calculating the pending reactions list.
   */
  batchedActionsCount: number;
  /**
   * Indicates whether the pending reactions are being calculated or not.
   */
  isRunningReactions: boolean;
  /**
   * Identifies the outermost action that is running, and null when no action is running. This
   * information allows computed values to cache themselves if accessed multiple times within a
   * single action.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export type Disposer = () => void;

export type ComparisonType = "default" | "structural";
export type EqualityChecker = (a: Any, b: Any) => boolean;

export interface IFobxAdmin {
  name: string;
}

export const $fobx = Symbol.for("fobx-administration");

export function getGlobalState(): GlobalState {
  // @ts-expect-error - global def doesn't know about $fobx symbol
  if (globalThis[$fobx] !== undefined) return globalThis[$fobx];

  let id = 0;

  const state: GlobalState = {
    batchedActionsCount: 0,
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
