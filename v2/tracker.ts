/**
 * Tracker — a minimal tracking primitive for view-layer integrations.
 *
 * Provides two operations:
 *   track(fn) — run fn with dependency tracking; when deps change, onInvalidate fires
 *   dispose()  — remove all dependency subscriptions
 *
 * During track(), any reactive notifications targeting this tracker are suppressed.
 * This prevents self-induced re-renders when e.g. a ViewModel updates observable
 * props during the same render pass. The suppression is per-tracker (not global),
 * making it safe for nested/child components.
 */

import {
  getNextId,
  KIND_REACTION,
  type ReactionAdmin,
  UP_TO_DATE,
} from "./global.ts"
import { removeFromAllDeps, withTracking } from "./tracking.ts"

export interface Tracker {
  /** Run fn with dependency tracking. When tracked deps change later, onInvalidate fires. */
  track<T>(fn: () => T): T
  /** Remove all dependency subscriptions. Safe to call multiple times. */
  dispose(): void
}

export function createTracker(
  onInvalidate: () => void,
  name?: string,
): Tracker {
  let isDisposed = false
  let isTracking = false

  const id = getNextId()
  const admin: ReactionAdmin = {
    kind: KIND_REACTION,
    id,
    name: name || `Tracker@${id}`,
    state: UP_TO_DATE,
    deps: [],
    run: () => {
      if (isDisposed) return

      if (isTracking) {
        // Suppress runs during tracking — the tracked function IS the current
        // render, so we are already consuming the latest state. Re-running
        // would be redundant and could cause mid-render side effects.
        admin.state = UP_TO_DATE
        return
      }

      admin.state = UP_TO_DATE
      onInvalidate()
    },
  }

  return {
    track<T>(fn: () => T): T {
      isTracking = true
      try {
        return withTracking(admin, fn)
      } finally {
        // Ensure state is UP_TO_DATE after tracking. During tracking, the admin
        // may have been marked STALE (and run was suppressed). Resetting here
        // ensures the next dep change properly transitions STALE → run.
        admin.state = UP_TO_DATE
        isTracking = false
      }
    },
    dispose() {
      if (isDisposed) return
      isDisposed = true
      removeFromAllDeps(admin)
    },
  }
}
