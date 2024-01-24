import type { IObservableValueAdmin, IReactionAdmin } from "../types";

import { isComputedValueAdmin } from "../utils/predicates";

import { getGlobalState } from "../state/global";

const globalState = /* @__PURE__ */ getGlobalState();

export function setReactionContext(reaction: IReactionAdmin | null) {
  const previous = globalState.reactionContext;
  globalState.reactionContext = reaction;
  return previous;
}

export function runWithTracking(fn: () => void, reaction: IReactionAdmin) {
  const previousDependencies = reaction.dependencies;
  // TODO: make this a pre-allocated and directly assign values to index instead of push (see if it improves performance)
  const dependencies: IObservableValueAdmin[] = [];
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

  let l = 0;
  let len = dependencies.length;
  for (let i = 0; i < len; i += 1) {
    const dep = dependencies[i];
    if (dep.seen) continue;
    dep.seen = true;
    // this gets out of sync once we come across first duplicate
    if (l !== i) {
      dependencies[l] = dep;
    }
    l++;
  }
  dependencies.length = l;

  len = previousDependencies.length;
  for (let i = 0; i < len; i += 1) {
    const dep = previousDependencies[i];
    if (!dep.seen) {
      dep.observers.delete(reaction);
      if (dep.observers.size === 0 && isComputedValueAdmin(dep)) {
        removeAllDependencies(dep);
      }
    }
    dep.seen = false;
  }

  for (let i = 0; i < l; i += 1) {
    const dep = dependencies[i];
    if (!dep.seen) continue;
    dep.observers.add(reaction);
    dep.seen = false;
  }
  reaction.dependencies = dependencies;
  return caughtException;
}

export function reportExceptionInReaction(reaction: IReactionAdmin, err: unknown) {
  if (process.env.NODE_ENV !== "production") {
    if (globalState.actionThrew) {
      console.error(
        `[@fobx/core] Reaction's exception was suppressed because an action threw an error first. Fix the action's error below first.`
      );
    } else {
      console.error(`[@fobx/core] "${reaction.name}" threw an exception.`, err);
    }
  }
  // TODO: call onReactionError
}

export function trackObservable(observable: IObservableValueAdmin) {
  // no reaction context means there's nothing to connect the observable to
  const reaction = globalState.reactionContext;
  if (!reaction || reaction.isDisposed) return;

  observable.observers.add(reaction);
  reaction.newDependencies.push(observable);
}

export function removeAllDependencies(reaction: IReactionAdmin) {
  const { dependencies, newDependencies } = reaction;
  dependencies.forEach((dep) => {
    dep.observers.delete(reaction);
    if (dep.observers.size === 0 && isComputedValueAdmin(dep)) {
      removeAllDependencies(dep);
    }
  });
  dependencies.length = 0;
  // we could be in the middle of a reaction, in which case remove all new dependencies as well
  newDependencies.length = 0;
}
