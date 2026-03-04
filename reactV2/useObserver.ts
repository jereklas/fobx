/**
 * useObserver — the core hook that makes a React render function reactive.
 *
 * Uses v2's `createTracker` + React's `useSyncExternalStore` to:
 * 1. Track which observables the render function reads
 * 2. Schedule a re-render when any of those observables change
 *
 * The tracker's `isTracking` suppression (built into createTracker) prevents
 * self-induced re-renders when observables are written during the same render
 * pass (e.g., useViewModel calling vm.update(props)).
 *
 * ─── StrictMode extra render ──────────────────────────────────────────────────
 * In React 18 StrictMode dev mode, useSyncExternalStore's subscribe is invoked,
 * then the cleanup is called, then subscribe is invoked again (simulating an
 * unmount/remount cycle). The current implementation disposes the tracker in the
 * cleanup, so the re-subscribe must recreate it. A new tracker starts with zero
 * deps; the ONLY way to re-populate its deps is to run tracker.track(render)
 * during a render pass. Therefore, bumping stateVersion to trigger a
 * subscribe-recovery render is ARCHITECTURALLY NECESSARY — not a bug.
 *
 * Why not useReducer+useEffect instead? useSyncExternalStore provides tearing
 * prevention in React concurrent/Suspense mode: getSnapshot is called both
 * during render and after subscribe, ensuring the component doesn't commit a
 * stale value. useReducer+useEffect loses this guarantee. The one extra
 * subscribe-recovery render in StrictMode is the correct trade-off.
 */

// @ts-ignore - to suppress tsc false error
import { useRef, useSyncExternalStore } from "react"
import { createTracker, type Tracker } from "@fobx/v2"
import { observerFinalizationRegistry } from "./finalizationRegistry.ts"

interface ObserverAdministration {
  tracker: Tracker | null
  /** Ticks on every invalidation — useSyncExternalStore uses this to detect changes */
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
    // First render — create the administration object.
    // All callbacks close over `adm` (not admRef) to avoid preventing GC
    // of the ref object, which would defeat FinalizationRegistry.
    const adm: ObserverAdministration = {
      tracker: null,
      stateVersion: Symbol(),
      onStoreChange: null,

      subscribe(onStoreChange: () => void) {
        // Component mounted — remove from finalization registry
        observerFinalizationRegistry.unregister(adm)
        adm.onStoreChange = onStoreChange

        if (!adm.tracker) {
          // Tracker was disposed before mount. This occurs when:
          // 1. Finalization registry disposed it before component mounted.
          // 2. React re-mounted same component without calling render in between (StrictMode).
          // Recreate tracker and force a snapshot change to trigger a re-render.
          // The re-render is NECESSARY — it’s the only opportunity to call
          // tracker.track(render) and re-establish dep subscriptions on the new
          // tracker (which starts with zero deps).
          adm.tracker = createTrackerForAdm(adm)
          adm.stateVersion = Symbol()
        }

        // Cleanup on unmount
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

  // Create tracker if needed (first render, or tracker was disposed by registry)
  if (!adm.tracker) {
    adm.tracker = createTrackerForAdm(adm)
    // Register for cleanup in case this render is abandoned
    observerFinalizationRegistry.register(adm, adm.tracker)
  }

  useSyncExternalStore(adm.subscribe, adm.getSnapshot, adm.getSnapshot)

  // Run the render function inside the tracker to establish dep subscriptions.
  // Exceptions are caught and re-thrown in React's function scope
  // so they trigger React error boundaries correctly.
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
