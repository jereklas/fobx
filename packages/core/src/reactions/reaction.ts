import type {
  Disposer,
  IObservableValueAdmin,
  IFobxAdmin,
  StateNotification,
  ComparisonType,
  EqualityChecker,
} from "../types";

// eslint-disable-next-line import/no-cycle
import { action } from "../transactions/action";
import { getGlobalState, $fobx } from "../state/global";
import { isDifferent } from "../state/instance";
import {
  removeAllDependencies,
  reportExceptionInReaction,
  runWithTracking,
  trackObservable,
} from "../transactions/tracking";
import { isObservableCollection } from "../utils/predicates";

const globalState = /* @__PURE__ */ getGlobalState();

export type ReactionWithAdmin = Reaction & {
  [$fobx]: ReactionAdmin;
};
export interface IReaction {
  track: (fn: () => void) => void;
  dispose: Disposer;
}
export interface IReactionAdmin extends IFobxAdmin {
  dependenciesChanged: boolean;
  staleCount: number;
  readyCount: number;
  canRun: () => boolean;
  isDisposed: boolean;
  isPending: boolean;
  hasToRun?: true;
  dependencies: IObservableValueAdmin[];
  newDependencies: IObservableValueAdmin[];
  onStateChange: (update: StateNotification) => void;
  run: () => void;
  dispose: Disposer;
}

const MAX_ITERATIONS = 100;

export class ReactionAdmin implements IReactionAdmin {
  name: string;
  dependenciesChanged = false;
  staleCount = 0;
  readyCount = 0;
  isDisposed = false;
  isPending = false;
  dependencies = [];
  newDependencies = [];
  hasToRun?: true;
  effectFn: () => void;

  constructor(effectFn: () => void, name?: string) {
    this.name = `${name ?? "Reaction"}@${globalState.getNextId()}`;
    this.effectFn = effectFn;
  }
  canRun() {
    return this.staleCount === this.readyCount;
  }
  run() {
    this.dependenciesChanged = false;
    try {
      this.effectFn();
    } catch (e) {
      reportExceptionInReaction(this, e);
    }
  }
  onStateChange(update: StateNotification) {
    switch (update.type) {
      case "stale":
        this.staleCount++;
        break;
      case "ready":
        this.readyCount++;
      // eslint-disable-next-line no-fallthrough
      case "change":
        this.dependenciesChanged ||= update.oldValue !== update.newValue;
        break;
    }

    if (!this.isPending && this.dependenciesChanged) {
      this.isPending = true;
      this.addToPendingReactions();
    }
  }

  addToPendingReactions() {
    globalState.pendingReactions.push(this);
  }

  dispose() {
    const { pendingReactions } = globalState;
    let idx: number;
    this.isDisposed = true;
    if (!this.hasToRun && (idx = pendingReactions.indexOf(this)) >= 0) {
      pendingReactions.splice(idx, 1);
    }
    removeAllDependencies(this);
  }
}

export class Reaction implements IReaction {
  constructor(admin: ReactionAdmin) {
    Object.defineProperty(this, $fobx, { value: admin });
  }
  track(this: Reaction, fn: () => void) {
    startBatch();
    runWithTracking(fn, (this as ReactionWithAdmin)[$fobx]);
    endBatch();
  }
  dispose(this: Reaction) {
    (this as ReactionWithAdmin)[$fobx].dispose();
  }
}

export class ReactionWithoutBatch extends Reaction {
  constructor(admin: ReactionAdmin) {
    super(admin);
  }
  track(this: ReactionWithoutBatch, fn: () => void) {
    runWithTracking(fn, (this as ReactionWithAdmin)[$fobx]);
  }
}

export function runReactions() {
  if (globalState.batchedActionsCount > 0 || globalState.isRunningReactions) return;
  globalState.isRunningReactions = true;

  const reactions = globalState.pendingReactions;
  let iterations = 0;

  while (reactions.length > 0) {
    if (++iterations === MAX_ITERATIONS) {
      reactions.length = 0;
      if (process.env.NODE_ENV !== "production") {
        console.error("failed to run reactions");
      }
    }

    let i, j;
    for (i = 0, j = 0; i < reactions.length; i += 1) {
      const reaction = reactions[i];
      // swap reactions we can't compute to front of array (in-order)
      if (!reaction.canRun()) {
        reactions[j] = reactions[i];
        j++;
        continue;
      }
      runReaction(reactions[i]);
    }
    // remove all reactions that ran
    while (j < reactions.length) {
      reactions.pop();
    }
  }

  globalState.isRunningReactions = false;
}

export function startBatch() {
  globalState.batchedActionsCount++;
}

export function endBatch() {
  globalState.batchedActionsCount--;
  runReactions();
  if (globalState.batchedActionsCount === 0) {
    globalState.currentlyRunningAction = null;
  }
}

function runReaction(reaction: IReactionAdmin) {
  reaction.isPending = false;
  reaction.staleCount = 0;
  reaction.readyCount = 0;
  // run the reaction after clearing out the above state. This is needed as some reactions might
  // need to re-queue themselves in the case of state changing within the reaction.
  reaction.run();
}

export type ReactionOptions = {
  comparer?: ComparisonType;
  fireImmediately?: boolean;
  equals?: EqualityChecker;
};

export function reaction<T>(
  dataFn: (reaction: IReaction) => T,
  effectFn: (current: T, previous: T, reaction: IReaction) => void,
  options: ReactionOptions = {}
) {
  let firstRun = true;
  let previousValue: T | undefined;
  let value: T;

  const reaction = new Reaction(
    new ReactionAdmin(() => {
      runReaction();
    })
  ) as ReactionWithAdmin;

  const effectAction = action(
    (current: T, previous: T, reaction: IReaction) => {
      effectFn(current, previous, reaction);
    },
    { name: `${reaction[$fobx].name}-sideEffect` }
  );

  const runReaction = () => {
    let changed = false;
    let error;

    reaction.track(() => {
      previousValue = value;
      try {
        value = dataFn(reaction);
      } catch (e) {
        // reaction.track handles the error which is why we are re-throwing, catching so we can prevent side effect fn
        error = e;
        throw error;
      }
      if (isObservableCollection(value)) trackObservable(value[$fobx]);
    });

    // should only run comparison and side effects if data function didn't throw
    if (!error) {
      changed = firstRun || valuesAreDifferent(options, previousValue, value);

      if (firstRun && options?.fireImmediately) {
        effectAction(value, previousValue as T, reaction);
      } else if (!firstRun && changed) {
        effectAction(value, previousValue as T, reaction);
      }
    }

    firstRun = false;
  };

  runReaction();
  return () => reaction.dispose();
}

function valuesAreDifferent(options: ReactionOptions, previous: unknown, current: unknown) {
  return isDifferent(previous, current, options?.equals ?? options.comparer)
    ? true
    : isObservableCollection(current)
      ? isDifferent(current[$fobx].previous, current[$fobx].current, options?.equals ?? options.comparer)
      : false;
}
