import type { IReactionAdmin, Any, IObservableCollectionAdmin } from "../types";

import { createIdGenerator } from "../utils/idGen";
import { $fobx } from "../state/global";
import { runInAction } from "../transactions/action";
import { sendChange } from "./notifications";
import { trackObservable } from "../transactions/tracking";

import { incrementChangeCount, wrapIteratorForTracking } from "./helpers";
import { isObject, isObservable } from "../utils/predicates";

// eslint-disable-next-line import/no-cycle
import { observable } from "./observable";

const getNextId = /* @__PURE__ */ createIdGenerator();

export type ObservableSetWithAdmin<T = Any> = ObservableSet<T> & {
  [$fobx]: IObservableCollectionAdmin<T>;
};
export type SetOptions = {
  deep?: boolean;
};
export class ObservableSet<T = Any> extends Set<T> {
  #deep: boolean;

  constructor();
  constructor(values?: T[], options?: SetOptions);
  constructor(iterable?: Iterable<unknown> | null | undefined, options?: SetOptions);
  constructor(values: T[] = [], options?: SetOptions) {
    super();
    values.forEach((v) => {
      this.#add(v);
    });
    const name = `ObservableSet@${getNextId()}`;
    this.#deep = options?.deep ?? true;
    // assigning the constructor to Set allows for deep compares to correctly compare this against other sets
    this.constructor = Set;
    Object.defineProperty(this, $fobx, {
      value: {
        value: this,
        name: name,
        getNextChangeId: createIdGenerator(),
        changes: 0,
        previous: `${name}.0`,
        current: `${name}.0`,
        observers: new Set<IReactionAdmin>(),
        seen: false,
      },
    });
  }
  toString() {
    return `[object ObservableSet]`;
  }
  #add(value: T) {
    const val = this.#deep && isObject(value) && !isObservable(value) ? (observable(value) as T) : value;
    super.add(val);
  }
  add(value: T) {
    if (super.has(value)) return this;
    const admin = (this as unknown as ObservableSetWithAdmin)[$fobx];
    runInAction(() => {
      this.#add(value);
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
    });
    return this;
  }

  clear(this: ObservableSet) {
    const admin = (this as ObservableSetWithAdmin)[$fobx];
    runInAction(() => {
      super.clear();
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
    });
  }
  delete(this: ObservableSet, value: T) {
    const admin = (this as ObservableSetWithAdmin)[$fobx];
    return runInAction(() => {
      const result = super.delete(value);
      if (result) {
        incrementChangeCount(admin);
        sendChange(admin, admin.previous, admin.current);
      }
      return result;
    });
  }
  forEach(this: ObservableSet, callbackFn: (value: T, key: T, map: Set<T>) => void, thisArg?: unknown) {
    trackObservable((this as ObservableSetWithAdmin)[$fobx]);
    super.forEach(callbackFn, thisArg);
  }
  has(this: ObservableSet, value: T) {
    trackObservable((this as ObservableSetWithAdmin)[$fobx]);
    return super.has(value);
  }
  replace(this: ObservableSet, entries: Set<T> | T[]) {
    const admin = (this as ObservableSetWithAdmin)[$fobx];
    const removed = new Set(this);
    if (!Array.isArray(entries) && !(entries instanceof Set)) {
      throw new Error(`[@fobx/core] Supplied entries was not a Set or an Array.`);
    }

    runInAction(() => {
      super.clear();
      entries.forEach((v) => {
        if (removed.has(v)) {
          removed.delete(v);
        }
        super.add(v);
      });
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
    });
  }
  toJSON(this: ObservableSet) {
    trackObservable((this as ObservableSetWithAdmin)[$fobx]);
    return Array.from(super.values());
  }
  entries(this: ObservableSet) {
    return wrapIteratorForTracking(super.entries(), (this as ObservableSetWithAdmin)[$fobx]);
  }
  keys(this: ObservableSet) {
    return wrapIteratorForTracking(super.keys(), (this as ObservableSetWithAdmin)[$fobx]);
  }
  values(this: ObservableSet) {
    return wrapIteratorForTracking(super.values(), (this as ObservableSetWithAdmin)[$fobx]);
  }
}
