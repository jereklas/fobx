/**
 * When — one-time reaction that disposes itself when predicate becomes true.
 */

import {
  _batchDepth,
  type Dispose,
  getNextId,
  KIND_WHEN,
  pushPending,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import { removeFromAllDeps, withoutTracking, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./batch.ts"

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

  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
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
        predicateResult = withTracking(admin, () => predicate(dispose))
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
        withoutTracking(() => {
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

  if (_batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}

function createWhenPromise(
  predicate: () => boolean,
  options?: WhenOptions,
): WhenPromise {
  let cancel!: () => void
  let abort!: () => void
  const promise = new Promise<void>((resolve, reject) => {
    const dispose = createWhen(predicate, resolve, {
      ...options,
      onError: reject,
    })
    cancel = () => {
      dispose()
      reject(new Error(ERR_CANCEL))
    }
    abort = () => {
      dispose()
      reject(new Error(ERR_ABORT))
    }
    options?.signal?.addEventListener("abort", abort)
  }).finally(() =>
    options?.signal?.removeEventListener("abort", abort)
  ) as WhenPromise
  promise.cancel = cancel

  return promise
}
