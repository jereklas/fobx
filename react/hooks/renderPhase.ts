/**
 * React render-phase coordination for fobx observer invalidations.
 *
 * When an observable write happens during a React render (for example,
 * useViewModel() syncing props during render), invalidating another observer
 * synchronously causes React's "Cannot update a component while rendering a
 * different component" warning. We defer such invalidations until the current
 * render stack unwinds, then flush them in a microtask.
 */

type DeferredCallback = () => void

let renderPhaseDepth = 0
let flushScheduled = false
const deferredCallbacks = new Set<DeferredCallback>()

function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(flushDeferredCallbacks)
}

function flushDeferredCallbacks(): void {
  flushScheduled = false

  if (renderPhaseDepth > 0) {
    scheduleFlush()
    return
  }

  if (deferredCallbacks.size === 0) return

  const callbacks = Array.from(deferredCallbacks)
  deferredCallbacks.clear()

  for (let i = 0; i < callbacks.length; i++) {
    callbacks[i]()
  }
}

export function runInRenderPhase<T>(fn: () => T): T {
  renderPhaseDepth++
  try {
    return fn()
  } finally {
    renderPhaseDepth--

    if (renderPhaseDepth === 0 && deferredCallbacks.size > 0) {
      scheduleFlush()
    }
  }
}

export function notifyAfterRender(callback: DeferredCallback): void {
  if (renderPhaseDepth === 0) {
    callback()
    return
  }

  deferredCallbacks.add(callback)
  scheduleFlush()
}
