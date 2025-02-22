import type { IObservableAdmin } from "../observables/observableBox";
import type { IReactionAdmin, ReactionAdmin } from "../reactions/reaction";
import { isComputedValueAdmin } from "../utils/predicates";
import { getGlobalState } from "../state/global";
import { instanceState } from "../state/instance";

const globalState = /* @__PURE__ */ getGlobalState();

export function setReactionContext(reaction: IReactionAdmin | null) {
  const previous = globalState.reactionContext;
  globalState.reactionContext = reaction;
  return previous;
}

export function runWithTracking(fn: () => void, reaction: IReactionAdmin) {
  const previousDependencies = reaction.dependencies;
  // TODO: make this a pre-allocated and directly assign values to index instead of push (see if it improves performance)
  const dependencies: IObservableAdmin[] = [];
  reaction.newDependencies = dependencies;
  let caughtException: unknown;

  const previousContext = setReactionContext(reaction);
  try {
    fn();
  } catch (e) {
    caughtException = e;
    reportExceptionInReaction(reaction, e);
  }
  setReactionContext(previousContext);

  for (let i = 0; i < previousDependencies.length; i += 1) {
    const dep = previousDependencies[i];
    if (dependencies.includes(dep)) continue;

    removeReaction(dep, reaction);
  }

  reaction.dependencies = dependencies;
  return caughtException;
}

export function reportExceptionInReaction(
  reaction: IReactionAdmin,
  err: unknown,
) {
  if (process.env.NODE_ENV !== "production") {
    if (instanceState.actionThrew) {
      console.error(
        `[@fobx/core] Reaction's exception was suppressed because an action threw an error first. Fix the action's error below first.`,
      );
    } else {
      console.error(`[@fobx/core] "${reaction.name}" threw an exception.`, err);
    }
  }
  instanceState?.onReactionError?.(err, reaction as ReactionAdmin);
}

export function trackObservable(observable: IObservableAdmin) {
  // no reaction context means there's nothing to connect the observable to
  const reaction = globalState.reactionContext;
  if (!reaction || reaction.isDisposed) return;

  if (!observable.observers.includes(reaction)) {
    observable.observers.push(reaction);
  }
  if (!reaction.newDependencies.includes(observable)) {
    reaction.newDependencies.push(observable);
  }
}

function removeReaction(dep: IObservableAdmin, reaction: IReactionAdmin) {
  const { observers } = dep;
  const index = observers.indexOf(reaction);
  if (index >= 0) {
    observers[index] = observers[observers.length - 1];
    observers.length = observers.length - 1;
  }
  if (dep.observers.length === 0 && isComputedValueAdmin(dep)) {
    // must explicitly reset this so next time computed becomes active is correctly re-computes
    dep.previousObserverCount = 0;
    removeAllDependencies(dep);
  }
}

export function removeAllDependencies(reaction: IReactionAdmin) {
  const { dependencies, newDependencies } = reaction;
  dependencies.forEach((dep) => removeReaction(dep, reaction));

  dependencies.length = 0;
  // we could be in the middle of a reaction, in which case remove all new dependencies as well
  newDependencies.length = 0;
}
