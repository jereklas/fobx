import type {
  IReactionAdmin,
  Any,
  IObservable,
  IObservableCollectionAdmin,
  IObservableValue,
  IObservableValueAdmin,
  ObservableSetWithAdmin,
  ObservableValueWithAdmin,
} from "../types";
import type { ObservableFactory } from "./observable";

import { $fobx, getGlobalState } from "../state/global";
import { instanceState } from "../state/instance";
import { runInAction } from "../transactions/action";
import { sendChange } from "./notifications";
import { trackObservable } from "../transactions/tracking";
import { createObservableValue } from "./observableValue";

import { incrementChangeCount, wrapIteratorForTracking } from "./helpers";
import { isObject, isObservable } from "../utils/predicates";

// eslint-disable-next-line import/no-cycle
import { observable } from "./observable";

export type ObservableMapWithAdmin = ObservableMap & {
  [$fobx]: IObservableCollectionAdmin;
};
export type MapOptions = { deep?: boolean };

const globalState = /* @__PURE__ */ getGlobalState();

export class ObservableMap<K = Any, V = Any> extends Map<K, V> {
  #keys: ObservableSetWithAdmin<K>;
  #deep = true;
  toString() {
    return `[object ObservableMap]`;
  }
  createObservable!: ObservableFactory;

  constructor();
  constructor(entries: readonly (readonly [K, V])[], options?: MapOptions);
  constructor(iterable?: Iterable<readonly [K, V]> | null | undefined, options?: MapOptions);
  constructor(record?: Record<PropertyKey, V>, options?: MapOptions);
  constructor(entries: Any = [], options?: MapOptions) {
    if (entries instanceof Map && entries.constructor !== Map && entries.constructor !== ObservableMap) {
      throw new Error(
        `[@fobx/core] Cannot make observable map from class that inherit from Map: ${entries.constructor.name}`
      );
    }
    super();
    const name = `ObservableMap@${globalState.getNextId()}`;
    this.#deep = options?.deep ?? true;
    this.#keys = observable<K>(new Set<K>()) as ObservableSetWithAdmin;
    // assigning the constructor to Map allows for deep compares to correctly compare this against other maps
    this.constructor = Map;
    // make sure options are set before we add initial values
    this.#addEntries(entries);
    Object.defineProperty(this, $fobx, {
      value: {
        value: this,
        name: name,
        changes: 0,
        previous: `${name}.0`,
        current: `${name}.0`,
        observers: new Set<IReactionAdmin>(),
        seen: false,
      },
    });
    Object.defineProperty(this, Symbol.iterator, {
      value: () => {
        return getEntriesIterator(super[Symbol.iterator](), (this as unknown as ObservableMapWithAdmin)[$fobx]);
      },
    });
  }
  #delete(this: ObservableMap, key: K, opts: { preventNotification: boolean } = { preventNotification: false }) {
    const result = super.delete(key);
    if (result) {
      this.#keys.delete(key);
      if (!opts.preventNotification) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx]);
      }
    }
    return result;
  }
  #set(this: ObservableMap, key: K, value: V, reusableValues: Map<K, V> = new Map()) {
    const val = this.#deep && isObject(value) && !isObservable(value) ? (observable(value) as V) : value;
    const reused = reusableValues.get(key) as IObservableValue<V>;
    const ov = reused ?? (super.get(key) as IObservableValue<V>);
    this.#keys.add(key);

    if (ov) {
      if (ov.value !== val) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx]);
      }
      if (reused) {
        super.set(key, ov as V);
      }
      ov.value = val;
    } else {
      super.set(key, createObservableValue(val) as V);
    }
  }
  #addEntries(entries: [K, V][] | Map<K, V> | Record<PropertyKey, V> | Iterable<readonly [K, V]>) {
    if (entries instanceof Map) {
      entries.forEach((value, key) => {
        this.#set(key, value);
      });
    } else if (Array.isArray(entries)) {
      entries.forEach(([key, value]) => {
        this.#set(key, value);
      });
    } else {
      for (const [key, val] of entries as Iterable<[K, V]>) {
        this.#set(key, val);
      }
    }
  }
  get size() {
    trackObservable((this as unknown as ObservableMapWithAdmin)[$fobx]);
    return super.size;
  }
  clear(this: ObservableMap) {
    const admin = (this as ObservableMapWithAdmin)[$fobx];
    runInAction(() => {
      this.#keys.clear();
      super.clear();
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
    });
  }
  delete(this: ObservableMap, key: K) {
    const admin = (this as ObservableMapWithAdmin)[$fobx];
    const ov = super.get(key) as IObservableValue<V | undefined> | undefined;

    if (process.env.NODE_ENV !== "production") {
      if (instanceState.enforceActions) {
        if (globalState.batchedActionsCount === 0 && admin.observers.size > 0) {
          console.warn(
            `[@fobx/core] Changing tracked observable value (${admin.name}) outside of an action is forbidden.`
          );
        }
      }
    }

    return runInAction(() => {
      if (ov) {
        ov.value = undefined;
      }
      const result = this.#delete(key, { preventNotification: true });
      if (result) {
        incrementChangeCount(admin);
        sendChange(admin, admin.previous, admin.current);
      }
      return result;
    });
  }
  forEach(this: ObservableMap, callbackFn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown) {
    trackObservable((this as ObservableMapWithAdmin)[$fobx]);
    const cb = (value: V, key: K, map: Map<K, V>) => {
      callbackFn((value as IObservableValue<V>).value, key, map);
    };
    super.forEach(cb, thisArg);
  }
  has(this: ObservableMap, key: K) {
    trackObservable((this as ObservableMapWithAdmin)[$fobx]);
    return super.has(key);
  }
  get(this: ObservableMap, key: K) {
    const ov = super.get(key) as ObservableValueWithAdmin<V> | undefined;
    if (ov) {
      trackObservable(ov[$fobx]);
    } else {
      trackObservable((this as ObservableMapWithAdmin)[$fobx]);
    }
    return ov?.value;
  }
  set(key: K, value: V) {
    const oldValue = (super.get(key) as IObservableValue<V> | undefined)?.value;
    if (oldValue === value) return this;
    const admin = (this as unknown as ObservableMapWithAdmin)[$fobx];

    if (process.env.NODE_ENV !== "production") {
      if (instanceState.enforceActions && globalState.batchedActionsCount === 0 && admin.observers.size > 0) {
        console.warn(
          `[@fobx/core] Changing tracked observable value (${admin.name}) outside of an action is forbidden.`
        );
      }
    }

    runInAction(() => {
      this.#set(key, value);
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
    });

    return this;
  }
  merge(this: ObservableMap, entries: [K, V][] | Map<K, V> | Record<PropertyKey, V>) {
    if (isObservable(entries)) {
      trackObservable((entries as IObservable)[$fobx] as IObservableValueAdmin);
    }
    const admin = (this as ObservableMapWithAdmin)[$fobx];
    runInAction(() => {
      this.#addEntries(entries);
      sendChange(admin, admin.previous, admin.current);
    });
  }
  replace(this: ObservableMap, entries: [K, V][] | Map<K, V> | Record<PropertyKey, V>) {
    const admin = (this as ObservableMapWithAdmin)[$fobx];
    const startingChangeCount = admin.changes;

    const originalKeys = [...this.#keys];

    const newKeys = new Set<K>();
    if (entries instanceof Map) {
      entries.forEach((_, key) => {
        newKeys.add(key);
      });
    } else if (Array.isArray(entries)) {
      entries.forEach(([key]) => {
        newKeys.add(key);
      });
    } else if (isObject(entries)) {
      Object.entries(entries).forEach(([key]) => {
        newKeys.add(key as K);
      });
    } else {
      throw new Error(`[@fobx/core] Cannot convert to map from '${entries}'`);
    }

    runInAction(() => {
      const oldValue = new Map<K, V>();
      const reusedValues = new Map<K, V>();

      super.forEach((ov, key) => {
        if (newKeys.has(key)) {
          reusedValues.set(key, ov);
          this.#delete(key, { preventNotification: true });
          return;
        }
        oldValue.set(key, (ov as IObservableValue).value);
        (ov as IObservableValue).value = undefined;
        this.#delete(key);
      });

      if (entries instanceof Map) {
        entries.forEach((value, key) => {
          this.#set(key, value, reusedValues);
        });
      } else if (Array.isArray(entries)) {
        entries.forEach(([key, value]) => {
          this.#set(key, value, reusedValues);
        });
      } else if (isObject(entries)) {
        Object.entries(entries).forEach(([key, value]) => {
          this.#set(key as K, value, reusedValues);
        });
      }

      if (!areSameOrder(originalKeys, this.#keys)) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx]);
      }

      if (startingChangeCount !== admin.changes) {
        sendChange(admin, admin.previous, admin.current);
      }
    });

    return this;
  }
  toJSON(this: ObservableMap) {
    trackObservable((this as ObservableMapWithAdmin)[$fobx]);

    return Array.from(this.entries());
  }
  entries() {
    return getEntriesIterator(super.entries(), (this as unknown as ObservableMapWithAdmin)[$fobx]);
  }
  keys() {
    return wrapIteratorForTracking(super.keys(), this.#keys[$fobx]);
  }
  values() {
    return getValuesIterator(super.values(), (this as unknown as ObservableMapWithAdmin)[$fobx]);
  }
}

const getValuesIterator = <V>(iterable: IterableIterator<V>, admin: IObservableCollectionAdmin) => {
  const original = iterable.next;
  Object.defineProperty(iterable, "next", {
    value: () => {
      trackObservable(admin);
      const next = original.call(iterable);
      if (next.value) {
        next.value = next.value.value;
      }
      return next;
    },
  });
  return iterable;
};

const getEntriesIterator = <K, V>(iterable: IterableIterator<[K, V]>, admin: IObservableCollectionAdmin) => {
  const original = iterable.next;
  Object.defineProperty(iterable, "next", {
    value: () => {
      trackObservable(admin);
      const next = original.call(iterable);
      if (next.value) {
        const [key, value] = next.value;

        next.value = [key, value.value];
      }
      return next;
    },
  });
  return iterable;
};

const areSameOrder = <K>(a: K[], b: Set<K>) => {
  if (a.length !== b.size) return false;
  let i = 0;
  let sameOrder = true;
  b.forEach((key) => {
    sameOrder = key === a[i];
    i++;
  });
  return sameOrder;
};
