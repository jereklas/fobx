import type { IReactionAdmin } from "../types";

import { createIdGenerator } from "../utils/idGen";

import { $fobx, getGlobalState } from "../state/global";
import { startBatch, endBatch } from "../reactions/reaction";
import { setReactionContext } from "./tracking";

const getNextId = /* @__PURE__ */ createIdGenerator();
const globalState = getGlobalState();

const previousContexts = new Map<number, IReactionAdmin | null>();

export type ActionOptions = { name?: string; getThis?: (that: unknown) => unknown };

// eslint-disable-next-line @typescript-eslint/ban-types
export function action<T extends Function>(fn: T, options?: ActionOptions) {
  const name = options?.name && options.name !== "" ? options.name : fn.name !== "" ? fn.name : "<unnamed action>";
  const action = function (this: unknown, ...args: unknown[]) {
    startAction();
    let result;
    try {
      // TODO: is this correct for browser?
      result = fn.call(options?.getThis ? options.getThis(this) : this, ...args);
    } catch (e) {
      globalState.actionThrew = true;
      throw e;
    } finally {
      endAction();
      globalState.actionThrew = false;
    }
    return result;
  } as unknown as T;
  Object.defineProperties(action, {
    name: { value: name },
    [$fobx]: { value: "action" },
  });
  Object.setPrototypeOf(action, fn);
  return action;
}

export function runInAction<T>(fn: () => T) {
  startAction();
  let result;
  try {
    result = fn();
  } catch (e) {
    globalState.actionThrew = true;
    throw e;
  } finally {
    endAction();
    globalState.actionThrew = false;
  }
  return result;
}

export function startAction() {
  globalState.currentlyRunningAction = getNextId();
  startUntracked();
  startBatch();
}

export function endAction() {
  if (process.env.NODE_ENV !== "production") {
    if (globalState.totalActionsRunning === 0) {
      throw Error("invalid endAction call");
    }
  }

  endUntracked();
  endBatch();
}

function startUntracked() {
  previousContexts.set(globalState.totalActionsRunning, setReactionContext(null));
}

function endUntracked() {
  const previous = previousContexts.get(globalState.totalActionsRunning - 1)!;
  setReactionContext(previous);
  previousContexts.delete(globalState.totalActionsRunning);
}
