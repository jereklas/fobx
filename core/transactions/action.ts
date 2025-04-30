import {
  endBatch,
  type IReactionAdmin,
  startBatch,
} from "../reactions/reaction.ts"
import { $fobx, type Any, getGlobalState } from "../state/global.ts"
import { instanceState } from "../state/instance.ts"
import { setReactionContext } from "./tracking.ts"

const globalState = /* @__PURE__ */ getGlobalState()

const previousContexts = new Map<number, IReactionAdmin | null>()

export type ActionOptions = {
  name?: string
  getThis?: (that: unknown) => unknown
}

export function action<T extends (...args: Any[]) => Any>(
  fn: T,
  options?: ActionOptions,
): T {
  const name = options?.name && options.name !== ""
    ? options.name
    : fn.name !== ""
    ? fn.name
    : "<unnamed action>"
  const action = function (this: unknown, ...args: unknown[]) {
    startAction()
    let result
    try {
      result = fn.call(options?.getThis ? options.getThis(this) : this, ...args)
    } catch (e) {
      instanceState.actionThrew = true
      throw e
    } finally {
      endAction()
      instanceState.actionThrew = false
    }
    return result
  } as unknown as T
  Object.defineProperties(action, {
    name: { value: name },
    [$fobx]: { value: "action" },
  })
  Object.setPrototypeOf(action, fn)
  return action
}

export function runInAction<T>(fn: () => T): T {
  startAction()
  let result
  try {
    result = fn()
  } catch (e) {
    instanceState.actionThrew = true
    throw e
  } finally {
    endAction()
    instanceState.actionThrew = false
  }
  return result
}

export function startAction() {
  globalState.currentlyRunningAction = globalState.getNextId()
  startUntracked()
  startBatch()
}

export function endAction() {
  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production") {
    if (globalState.batchedActionsCount === 0) {
      throw Error("invalid endAction call")
    }
  }

  endUntracked()
  endBatch()
}

function startUntracked() {
  previousContexts.set(
    globalState.batchedActionsCount,
    setReactionContext(null),
  )
}

function endUntracked() {
  const previous = previousContexts.get(globalState.batchedActionsCount - 1)!
  setReactionContext(previous)
  previousContexts.delete(globalState.batchedActionsCount)
}
