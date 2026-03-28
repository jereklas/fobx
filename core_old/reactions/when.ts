import { Reaction, ReactionAdmin, type ReactionWithAdmin } from "./reaction.ts"
import { action } from "../transactions/action.ts"
import { $fobx, type Any } from "../state/global.ts"

const ERR_TIMEOUT = "When reaction timed out"
const ERR_CANCEL = "When reaction was canceled"
const ERR_ABORT = "When reaction was aborted"

export type WhenPromise = Promise<void> & { cancel: () => void }
export type WhenOptions = {
  timeout?: number
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export function when(
  predicate: () => boolean,
  options?: WhenOptions,
): WhenPromise
export function when(
  predicate: () => boolean,
  sideEffectFn?: () => void,
  options?: WhenOptions,
): () => void
export function when(
  predicate: () => boolean,
  effectOrOptions: Any,
  options?: WhenOptions,
): WhenPromise | (() => void) {
  return typeof effectOrOptions !== "function"
    ? createWhenPromise(predicate, effectOrOptions)
    : createWhen(predicate, effectOrOptions, options)
}

function createWhen(
  predicate: () => boolean,
  sideEffectFn: () => void,
  options?: WhenOptions,
) {
  const reaction = new Reaction(
    new ReactionAdmin(() => {
      run()
    }, "When"),
  ) as ReactionWithAdmin

  let timeoutHandle: ReturnType<typeof setTimeout>

  if (options?.timeout) {
    timeoutHandle = setTimeout(
      () => {
        if (reaction[$fobx].isDisposed) return
        reaction.dispose()
        const err = new Error(ERR_TIMEOUT)
        if (options.onError) {
          options.onError(err)
        } else {
          throw err
        }
      },
      options?.timeout,
    )
  }

  const sideEffectAction = action(sideEffectFn, {
    name: `${reaction[$fobx].name}-sideEffect`,
  })

  const run = () => {
    let value = false
    reaction.track(() => {
      value = predicate()
    })

    if (value) {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      // set 'hasToRun' so that the dispose() will not prevent the side effect from running
      reaction[$fobx].hasToRun = true
      reaction.dispose()
      sideEffectAction()
    }
  }
  run()
  return () => {
    reaction.dispose()
  }
}

function createWhenPromise(predicate: () => boolean, options?: WhenOptions) {
  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production" && options?.onError) {
    throw new Error(
      "[@fobx/core] Cannot use onError option when using async when.",
    )
  }

  let cancel!: () => void
  let abort!: () => void
  const promise = new Promise((resolve, reject) => {
    const dispose = createWhen(predicate, resolve as () => void, {
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
