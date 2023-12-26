import { IReactionAdmin } from "../types";

interface GlobalState {
  /**
   * Counter tracking total number of actions running. This is used to know when it's safe
   * to start calculating the pending reactions list.
   */
  totalActionsRunning: number;
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
}

export const $fobx = Symbol.for("fobx-administration");

export function getGlobalState(): GlobalState {
  // @ts-expect-error - global def doesn't know about $fobx symbol
  if (globalThis[$fobx] !== undefined) return globalThis[$fobx];

  const state: GlobalState = {
    totalActionsRunning: 0,
    actionThrew: false,
    isRunningReactions: false,
    currentlyRunningAction: null as null | number,
    reactionContext: null as IReactionAdmin | null,
    pendingReactions: [] as IReactionAdmin[],
  };

  Object.defineProperty(globalThis, $fobx, {
    value: state,
  });

  return state;
}
