/* eslint-disable no-fallthrough */
import type { IObservableCollectionAdmin, Any, IReactionAdmin } from "../types";

import { createIdGenerator } from "../utils/idGen";
import { endAction, runInAction, startAction } from "../transactions/action";
import { sendChange } from "./notifications";
import { trackObservable } from "../transactions/tracking";
import { $fobx, getGlobalState } from "../state/global";
import { instanceState } from "../state/instance";

import { incrementChangeCount, wrapIteratorForTracking } from "./helpers";
import { isObject, isObservable } from "../utils/predicates";

// eslint-disable-next-line import/no-cycle
import { observable } from "./observable";

const getNextId = /* @__PURE__ */ createIdGenerator();

const globalState = getGlobalState();

export type ArrayOptions = {
  deep?: boolean;
};

export interface ObservableArrayWithAdmin<T = Any> extends ObservableArray<T> {
  [$fobx]: IObservableArrayAdmin;
}
export interface ObservableArray<T = Any> extends Array<T> {
  replace: (newArray: T[]) => T[];
  remove: (item: T) => number;
  clear: () => T[];
  toJSON: () => T[];
}
export interface IObservableArrayAdmin<T = Any> extends IObservableCollectionAdmin<T> {
  runningAction: string;
  temp: T[];
}

export function createObservableArray<T = Any>(initialValue: T[] = [], options?: ArrayOptions) {
  const deep = options?.deep ?? true;
  const arr: T[] = [];
  // have to use for-loop as forEach ignores empty slots (i.e. observable(new Array(10)) wont correctly be length 10)
  for (let i = 0; i < initialValue.length; i += 1) {
    arr.push(
      deep && isObject(initialValue[i]) && !isObservable(initialValue[i])
        ? (observable(initialValue[i]) as T)
        : initialValue[i]
    );
  }
  const internalName = `ObservableArray@${getNextId()}`;
  const admin: IObservableArrayAdmin<T[]> = {
    value: arr,
    temp: [],
    name: internalName,
    observers: new Set<IReactionAdmin>(),
    getNextChangeId: createIdGenerator(),
    changes: 0,
    seen: false,
    previous: `${internalName}.0`,
    current: `${internalName}.0`,
    runningAction: "",
  };
  Object.defineProperties(arr, {
    [$fobx]: { value: admin },
    remove: { value: remove, writable: true },
    replace: { value: replace, writable: true },
    clear: { value: clear, writable: true },
    toJSON: { value: toJSON, writable: true },
  });

  return new Proxy(arr as ObservableArrayWithAdmin, {
    get(target, prop, proxy) {
      if (typeof prop === "symbol") {
        if (prop === $fobx) return admin;
        if (prop === Symbol.iterator) {
          trackObservable(admin);
          // binding the function to force the iterator through the non-proxied array for performance
          return target.values.bind(target);
        }
        return target[prop as keyof typeof target];
      }
      if (prop === "length" || isIndex(prop)) {
        trackObservable(admin);
      }

      const value = target[prop as keyof typeof target];
      if (typeof value === "function") {
        if (noArgFns.has(prop)) {
          return () => {
            let result;
            if (globalState.reactionContext && prop === "reverse") {
              const alternative = mutationFns[prop];
              throw new Error(
                `[@fobx/core] "observableArray.reverse" mutates state in-place, which cannot happen in a reaction. Use "${alternative}" instead.`
              );
            }

            try {
              startFnCall(admin, prop);
              if (prop === "entries") result = wrapIteratorForTracking(target.entries(), admin);
              else if (prop === "keys") result = wrapIteratorForTracking(target.keys(), admin);
              else if (prop === "values") result = wrapIteratorForTracking(target.values(), admin);
              else result = value.call(target);
            } finally {
              endFnCall(admin, prop, result);
            }
            return result;
          };
        }
        if (singleArgFns.has(prop)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (a: Any) => {
            let result;
            if (globalState.reactionContext && prop === "sort") {
              const alternative = mutationFns[prop];
              throw new Error(
                `[@fobx/core] "observableArray.${prop}" mutates state in-place, which cannot happen in a reaction. Use "${alternative}" instead.`
              );
            }

            try {
              startFnCall(admin, prop);
              result = value.call(target, a);
            } finally {
              endFnCall(admin, prop, result);
            }
            return result;
          };
        }
        if (twoArgFns.has(prop)) {
          return (a: Any, b: Any) => {
            let result;
            try {
              startFnCall(admin, prop);
              result = value.call(target, a, b);
            } finally {
              endFnCall(admin, prop, result);
            }
            return result;
          };
        }
        if (threeArgFns.has(prop)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (a: any, b: any, c: any) => {
            let result;
            try {
              startFnCall(admin, prop);
              if (prop === "copyWithin") {
                // copyWithin doesn't give access to removed elements, so we need to take the performance
                // hit and pass it through the proxy so that the set trap observes each index that gets re-assigned.
                result = value.call(proxy, a, b, c);
              } else {
                result = value.call(target, a, b, c);
              }
            } finally {
              endFnCall(admin, prop, result);
            }
            return result;
          };
        }
        return (...args: Any[]) => {
          let result;
          try {
            startFnCall(admin, prop);
            if (prop === "push" || prop === "unshift" || prop === "splice") {
              const start = prop === "splice" ? 2 : 0;
              for (let i = start; i < args.length; i += 1) {
                args[i] = convertValue(args[i], deep);
              }
              result = value.apply(target, args);
            } else if (prop === "replace") {
              for (let i = 0; i < args[0].length; i += 1) {
                args[0][i] = convertValue(args[0][i], deep);
              }
              result = value.apply(target, args);
            } else {
              result = value.apply(target, args);
            }
          } finally {
            endFnCall(admin, prop, result, args.length);
          }
          return result;
        };
      } else {
        return value;
      }
    },
    set(target, prop, newValue) {
      if (admin.runningAction === "copyWithin") {
        admin.temp.push(target[prop as unknown as number]);
        target[prop as unknown as number] = newValue;
      } else {
        if (target[prop as unknown as number] === newValue) return true;
        incrementChangeCount(admin);

        runInAction(() => {
          target[prop as unknown as number] = prop === "length" ? newValue : convertValue(newValue, deep);
          sendChange(admin, admin.previous, admin.current);
        });
      }

      return true;
    },
  });
}

const noArgFns = new Set([
  "entries",
  "keys",
  "pop",
  "reverse",
  "shift",
  "toLocaleString",
  "toReversed",
  "toString",
  "values",
]);
const singleArgFns = new Set(["at", "flat", "join", "sort", "toSorted"]);
const twoArgFns = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "includes",
  "indexOf",
  "lastIndexOf",
  "map",
  "slice",
  "some",
  "with",
]);
const threeArgFns = new Set(["copyWithin", "fill"]);

function convertValue<T>(value: T, deep: boolean) {
  if (!deep) return value;
  return isObject(value) && !isObservable(value) ? (observable(value) as T) : value;
}

function toJSON<T>(this: ObservableArrayWithAdmin<T>) {
  const admin = this[$fobx];
  trackObservable(admin);
  return admin.value;
}

function replace<T>(this: ObservableArrayWithAdmin<T>, newArray: T[]) {
  const originalLength = this.length;
  const removed: T[] = [];
  let i = 0;
  for (const len = newArray.length; i < len; i += 1) {
    if (i < originalLength) {
      removed.push(this[i]);
    }
    this[i] = newArray[i];
  }

  // original length of list was longer than new list, remove remaining
  while (i < originalLength) {
    removed.push(this.pop()!);
    i++;
  }
  return removed;
}

function remove<T>(this: ObservableArrayWithAdmin<T>, item: T) {
  const len = this.length;
  let indexFound = -1;
  let i = 0;

  while (indexFound === -1 && i < len) {
    if (this[i] === item) {
      indexFound = i;
    } else {
      i++;
    }
  }

  for (let last = len - 1; i < last; i += 1) {
    this[i] = this[i + 1];
  }

  if (indexFound !== -1) {
    this.pop();
  }
  return indexFound;
}

function clear<T>(this: ObservableArrayWithAdmin<T>) {
  const removed = this.slice();
  this.length = 0;
  return removed;
}

const mutationFns = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.create(null, {
    copyWithin: { value: "arr.slice().copyWithin()" },
    fill: { value: "arr.slice().fill()" },
    pop: { value: "arr.slice(0,-1)" },
    push: { value: "arr.concat([v1,v2,...])" },
    reverse: { value: "arr.toReversed()" },
    shift: { value: "arr.slice(1)" },
    sort: { value: "arr.toSorted()" },
    splice: { value: "arr.toSpliced()" },
    unshift: { value: "arr.toSpliced(0,0,v1,v2,...)" },
    // custom mutation function
    replace: { value: "none" },
    remove: { value: "none" },
    clear: { value: "none" },
  })
);

// this was the most performant way of identifying if a prop name was a direct index access
const numbers = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const isIndex = (key: string | symbol) => {
  if (typeof key === "symbol") return false;
  for (let i = 0; i < key.length; i += 1) {
    if (!numbers.has(key[i])) return false;
  }
  return true;
};

const startFnCall = (admin: IObservableArrayAdmin, prop: string) => {
  const alternative = mutationFns[prop];
  if (prop !== "entries" && prop !== "values" && prop !== "keys" && !alternative) {
    trackObservable(admin);
  }
  if (!alternative) return;

  if (
    process.env.NODE_ENV !== "production" &&
    instanceState.enforceActions &&
    globalState.totalActionsRunning === 0 &&
    admin.observers.size > 0
  ) {
    console.warn(
      `[@fobx/core] ${admin.name}.${prop}(...) was called outside of an action, this state change could be unpredictable.`
    );
  }
  admin.runningAction = prop;
  startAction();
};

const endFnCall = (admin: IObservableArrayAdmin, prop: string, result: Any, argsLength = 0) => {
  if (!mutationFns[prop]) return;
  const arr = admin.value as Array<unknown>;

  switch (prop) {
    case "copyWithin":
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
      admin.temp.length = 0;
      break;
    case "splice":
      if (result.length === 0 && argsLength < 3) break;
    case "pop":
      if (result === undefined && arr.length === 0) break;
    case "remove":
      if (result === -1) break;
    default:
      incrementChangeCount(admin);
      sendChange(admin, admin.previous, admin.current);
  }

  endAction();
  admin.runningAction = "";
};
