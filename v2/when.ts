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

export interface WhenOptions {
  name?: string
  timeout?: number
}

// Overloads
export function when(
  predicate: () => boolean,
  options?: WhenOptions,
): Promise<void>
export function when(
  predicate: () => boolean,
  effect: () => void,
  options?: WhenOptions,
): Dispose
export function when(
  predicate: () => boolean,
  effectOrOptions?: (() => void) | WhenOptions,
  maybeOptions?: WhenOptions,
): Promise<void> | Dispose {
  const hasEffect = typeof effectOrOptions === "function"
  const effect = hasEffect ? effectOrOptions : undefined
  const options = hasEffect
    ? maybeOptions
    : effectOrOptions as WhenOptions | undefined

  if (!effect) {
    return new Promise<void>((resolve, reject) => {
      let timerId: ReturnType<typeof setTimeout> | undefined
      const dispose = createWhen(
        predicate,
        () => {
          if (timerId !== undefined) clearTimeout(timerId)
          resolve()
        },
        options,
        (error) => {
          if (timerId !== undefined) clearTimeout(timerId)
          reject(error)
        },
      )
      if (options?.timeout) {
        timerId = setTimeout(() => {
          dispose()
          reject(new Error("[@fobx/core] Timeout waiting for condition"))
        }, options.timeout)
      }
    })
  }

  return createWhen(predicate, effect, options)
}

function createWhen(
  predicate: (dispose: Dispose) => boolean,
  effect: () => void,
  options?: WhenOptions,
  onError?: (error: Error) => void,
): Dispose {
  let isDisposed = false

  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
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
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }
        return
      }

      if (predicateResult) {
        withoutTracking(() => {
          try {
            effect()
          } catch (error) {
            if (onError) {
              onError(error instanceof Error ? error : new Error(String(error)))
            }
          }
        })
        dispose()
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
