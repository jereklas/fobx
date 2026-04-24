/**
 * When — one-time reaction that disposes itself when predicate becomes true.
 */

import {
  type Dispose,
  getNextId,
  KIND_WHEN,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "../state/global.ts"
import {
  removeFromAllDeps,
  runWithoutTracking,
  runWithTracking,
} from "./tracking.ts"
import { scheduleReaction } from "../transactions/transaction.ts"
import { markDebugDisposed, registerDebugNode } from "../state/debugGraph.ts"

const ERR_TIMEOUT = "When reaction timed out"
const ERR_CANCEL = "When reaction was canceled"
const ERR_ABORT = "When reaction was aborted"

export interface WhenOptions {
  name?: string
  timeout?: number
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export type WhenPromise = Promise<void> & { cancel: () => void }

// Overloads
export function when(
  predicate: () => boolean,
  options?: WhenOptions,
): WhenPromise
export function when(
  predicate: () => boolean,
  effect: () => void,
  options?: WhenOptions,
): Dispose
export function when(
  predicate: () => boolean,
  effectOrOptions?: (() => void) | WhenOptions,
  maybeOptions?: WhenOptions,
): WhenPromise | Dispose {
  const hasEffect = typeof effectOrOptions === "function"
  const effect = hasEffect ? effectOrOptions : undefined
  const options = hasEffect
    ? maybeOptions
    : effectOrOptions as WhenOptions | undefined

  if (!effect) {
    if (options?.onError) {
      throw new Error(
        "[@fobx/core] Cannot use onError option when using async when.",
      )
    }
    return createWhenPromise(predicate, options)
  }

  return createWhen(predicate, effect, options)
}

function createWhen(
  predicate: (dispose: Dispose) => boolean,
  effect: () => void,
  options?: WhenOptions,
): Dispose {
  let isDisposed = false
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined

  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    if (abortHandler) {
      options?.signal?.removeEventListener("abort", abortHandler)
    }
    // deno-lint-ignore no-process-global
    if (process.env.FOBX_DEBUG) {
      markDebugDisposed(admin)
    }
    removeFromAllDeps(admin)
  }

  if (options?.timeout) {
    timeoutHandle = setTimeout(
      () => {
        if (isDisposed) return
        dispose()
        const err = new Error(ERR_TIMEOUT)
        if (options.onError) {
          options.onError(err)
        } else {
          throw err
        }
      },
      options.timeout,
    )
  }

  const id = getNextId()
  const admin: ReactionAdmin = {
    kind: KIND_WHEN,
    id,
    name: options?.name || `When@${id}`,
    state: STALE,
    deps: [],
    run: () => {
      if (isDisposed) return
      admin.state = UP_TO_DATE

      let predicateResult: boolean
      try {
        predicateResult = runWithTracking(admin, () => predicate(dispose))
      } catch (error) {
        dispose()
        if (options?.onError) {
          options.onError(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
        return
      }

      if (predicateResult) {
        dispose()
        runWithoutTracking(() => {
          try {
            effect()
          } catch (error) {
            if (options?.onError) {
              options.onError(
                error instanceof Error ? error : new Error(String(error)),
              )
            }
          }
        })
      }
    },
  }

  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    registerDebugNode(admin, {
      admin,
      kind: "when",
      name: admin.name,
    })
  }

  if (options?.signal) {
    abortHandler = () => {
      if (isDisposed) return
      dispose()
      options.onError?.(new Error(ERR_ABORT))
    }

    if (options.signal.aborted) {
      abortHandler()
      return dispose
    }

    options.signal.addEventListener("abort", abortHandler)
  }

  scheduleReaction(admin)

  return dispose
}

function createWhenPromise(
  predicate: () => boolean,
  options?: WhenOptions,
): WhenPromise {
  let cancel!: () => void
  const promise = new Promise<void>((resolve, reject) => {
    const dispose = createWhen(predicate, resolve, {
      ...options,
      onError: reject,
    })
    cancel = () => {
      dispose()
      reject(new Error(ERR_CANCEL))
    }
  }) as WhenPromise
  promise.cancel = cancel

  return promise
}
