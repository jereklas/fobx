/**
 * Makes a React render function reactive.
 *
 * Tracks which observables are read during render and schedules a re-render
 * via useSyncExternalStore when any of them change.
 */

// @ts-ignore - to suppress tsc false error
import { useRef, useSyncExternalStore } from "react"
import { createTracker, type Tracker } from "@fobx/core/internals"
import { observerFinalizationRegistry } from "./finalizationRegistry.ts"

interface ObserverAdministration {
  tracker: Tracker | null
  /** Incremented on every invalidation; useSyncExternalStore uses this to detect changes. */
  stateVersion: symbol
  onStoreChange: (() => void) | null
  subscribe: (onStoreChange: () => void) => () => void
  getSnapshot: () => symbol
}

function createTrackerForAdm(adm: ObserverAdministration): Tracker {
  return createTracker(() => {
    adm.stateVersion = Symbol()
    adm.onStoreChange?.()
  }, `ReactObserver`)
}

export function useObserver<T>(
  render: () => T,
  _baseComponentName: string = "observed",
): T {
  const admRef = useRef<ObserverAdministration>(undefined)

  if (!admRef.current) {
    // Callbacks close over `adm` (not admRef) so the ref object remains
    // eligible for garbage collection, allowing FinalizationRegistry to fire.
    const adm: ObserverAdministration = {
      tracker: null,
      stateVersion: Symbol(),
      onStoreChange: null,

      subscribe(onStoreChange: () => void) {
        observerFinalizationRegistry.unregister(adm)
        adm.onStoreChange = onStoreChange

        if (!adm.tracker) {
          // Tracker was disposed before mount (e.g. by the finalization
          // registry, or during a StrictMode unmount/remount cycle).
          // Recreate it and bump stateVersion to trigger a re-render so that
          // dep subscriptions are re-established via tracker.track(render).
          adm.tracker = createTrackerForAdm(adm)
          adm.stateVersion = Symbol()
        }

        return () => {
          adm.onStoreChange = null
          adm.tracker?.dispose()
          adm.tracker = null
        }
      },

      getSnapshot() {
        return adm.stateVersion
      },
    }

    admRef.current = adm
  }

  const adm = admRef.current!

  // Create a tracker for this render if one doesn't already exist.
  if (!adm.tracker) {
    adm.tracker = createTrackerForAdm(adm)
    observerFinalizationRegistry.register(adm, adm.tracker)
  }

  useSyncExternalStore(adm.subscribe, adm.getSnapshot, adm.getSnapshot)

  // Run render inside the tracker to subscribe to any observables it reads.
  // Exceptions are re-thrown outside the tracker so React error boundaries
  // can catch them.
  let renderResult!: T
  let exception: unknown

  adm.tracker!.track(() => {
    try {
      renderResult = render()
    } catch (e) {
      exception = e
    }
  })

  if (exception) {
    throw exception
  }

  return renderResult
}
