import { $fobx, getGlobalState, type Any, type EqualityChecker, type ComparisonType } from "../state/global";
import { removeAllDependencies, runWithTracking, trackObservable } from "../transactions/tracking";
import type { IObservable, IObservableAdmin } from "../observables/observableBox";
import { sendReady, sendStale, type StateNotification } from "../observables/notifications";
import { startBatch, endBatch, type IReactionAdmin } from "./reaction";
import { runInAction } from "../transactions/action";
import { isDifferent } from "../state/instance";

const globalState = /* @__PURE__ */ getGlobalState();

export type ComputedWithAdmin<T = Any> = Computed<T> & {
  [$fobx]: ComputedAdmin<T>;
};
export interface IComputedValue<T> extends IObservable<T> {
  dispose: () => void;
}

export interface IComputedAdmin<T = Any> extends IReactionAdmin, IObservableAdmin<T> {
  previousObserverCount: number;
  lastActionComputedIn: number | null;
  hasComputedBefore: boolean;
  isUpToDate?: true;
  oldValue?: T;
}
export type ComputedOptions = {
  comparer?: ComparisonType;
  equals?: EqualityChecker;
  thisArg?: unknown;
};

class ComputedAdmin<T> implements IComputedAdmin<T> {
  name = `Computed@${globalState.getNextId()}`;
  value = undefined as T;
  staleCount = 0;
  readyCount = 0;
  seen = false;
  previousObserverCount = 0;
  isDisposed = false;
  isPending = false;
  hasComputedBefore = false;
  dependenciesChanged = false;
  isUpToDate?: true;
  dependencies = [];
  newDependencies = [];
  observers = new Set<IReactionAdmin>();
  lastActionComputedIn: number | null = null;
  oldValue?: T;
  options: ComputedOptions;
  getter: () => T;
  setter?: (v: T) => void;

  constructor(get: () => T, set?: (v: T) => void, options: ComputedOptions = {}) {
    this.getter = get;
    this.setter = set;
    this.options = options;
  }
  canRun() {
    return true;
  }
  onStateChange(update: StateNotification) {
    const { currentlyRunningAction: actionRunning } = globalState;
    switch (update.type) {
      case "stale":
        this.staleCount++;
        break;
      case "ready":
        this.readyCount++;
        if (this.staleCount === this.readyCount && actionRunning && actionRunning === this.lastActionComputedIn) {
          this.isUpToDate = true;
        }
      // eslint-disable-next-line no-fallthrough
      case "change":
        this.dependenciesChanged ||= update.oldValue !== update.newValue;
        break;
    }

    if (!this.isPending && this.dependenciesChanged) {
      this.isPending = true;
      globalState.pendingReactions.push(this);
      sendStale(this);
    }
  }

  calculateComputed() {
    const { thisArg } = this.options;
    this.lastActionComputedIn = globalState.currentlyRunningAction;
    this.previousObserverCount = this.observers.size;

    let value!: T;
    let error: unknown;

    // only run the computed with tracking if it's currently being observed itself
    if (this.observers.size > 0) {
      startBatch();
      error = runWithTracking(() => {
        value = thisArg ? this.getter.call(thisArg) : this.getter();
      }, this);

      // we need to set the value within the batch as long as there was no error (there's a test case that will fail this)
      if (!error) {
        this.value = value;
      }
      endBatch();
    } else {
      value = thisArg ? this.getter.call(thisArg) : this.getter();
    }

    if (error) {
      throw error;
    }

    this.dependenciesChanged = false;
    this.hasComputedBefore = true;
    this.value = value;
    return value;
  }
  run() {
    // function runComputed(admin: IComputedAdmin, get: () => unknown, equals: EqualityChecker, thisArg?: unknown) {
    // it's possible for a computed to no longer be observed between it being queued to run and it actually running.
    if (this.observers.size === 0) return;
    const needsToCompute = this.dependenciesChanged && !this.isUpToDate;
    const oldValue = needsToCompute ? this.value : this.oldValue;
    let newValue = oldValue;
    try {
      newValue = needsToCompute ? this.calculateComputed() : this.value;
      if (this.isUpToDate) {
        delete this.isUpToDate;
        this.dependenciesChanged = false;
      }
      if (isDifferent(oldValue, newValue, this.options.equals ?? this.options.comparer)) {
        sendReady(this, 0, 1);
      } else {
        sendReady(this, 0, 0);
      }
    } catch (e) {
      sendReady(this, 0, 0);
    }
  }
  dispose() {
    this.isDisposed = true;
    removeAllDependencies(this);
  }
}

class Computed<T> implements IComputedValue<T> {
  setterRunning = false;
  constructor(get: () => T, set?: (newValue: T) => void, options?: ComputedOptions) {
    Object.defineProperty(this, $fobx, { value: new ComputedAdmin(get, set, options) });
  }
  get value() {
    const admin = (this as unknown as ComputedWithAdmin)[$fobx];
    trackObservable(admin);

    const { currentlyRunningAction: actionRunning } = globalState;
    const { observers, previousObserverCount, dependenciesChanged, lastActionComputedIn, staleCount, readyCount } =
      admin;

    const alreadyRanThisAction = actionRunning && actionRunning === lastActionComputedIn;
    const hasObservers = observers.size !== 0;

    if (
      !dependenciesChanged &&
      (staleCount === readyCount || (staleCount !== readyCount && alreadyRanThisAction)) &&
      ((hasObservers && previousObserverCount !== 0) || alreadyRanThisAction)
    ) {
      return admin.value;
    }

    const { value: oldValue, hasComputedBefore } = admin;
    const newValue = admin.calculateComputed();
    // being here with observers means that the computed is being read inside of an action. Need to store in the middle of a action so we need to
    // store the old value so that we can report it correctly when the computed is ran during the reactions
    if (hasObservers) {
      admin.oldValue = hasComputedBefore ? oldValue : newValue;
    }
    return newValue;
  }
  set value(newValue: T) {
    const admin = (this as unknown as ComputedWithAdmin)[$fobx];
    const { setter, options } = admin;
    if (this.setterRunning) {
      throw new Error("[@fobx/core] Computed setter is assigning to itself, this will cause an infinite loop.");
    }
    this.setterRunning = true;

    // do nothing if there is not set function
    if (!setter) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[@fobx/core] There was an attempt to set a value on a computed value without any setter. Nothing was set.`
        );
      }
      return;
    }

    runInAction(() => {
      if (options.thisArg) {
        setter!.call(options.thisArg, newValue);
      } else {
        setter!(newValue);
      }
    });
    this.setterRunning = false;
  }

  dispose(this: ComputedWithAdmin) {
    this[$fobx].dispose();
  }
}

export function createComputedValue<T>(
  get: () => T,
  set?: (newValue: T) => void,
  options?: ComputedOptions
): Computed<T> {
  return new Computed(get, set, options);
}

export function computed<T>(getFn: () => T, options?: ComputedOptions): IComputedValue<T>;
export function computed<T>(getFn: () => T, setFn?: (value: T) => void, options?: ComputedOptions): IComputedValue<T>;
export function computed<T>(
  getFn: () => T,
  setOrOpts?: ((value: T) => void) | ComputedOptions,
  options?: ComputedOptions
): IComputedValue<T> {
  if (typeof setOrOpts === "function") {
    return new Computed(getFn, setOrOpts, options);
  }
  return new Computed(getFn, undefined, setOrOpts);
}
