/**
 * Finalization registry for observer trackers.
 *
 * React may render a component and then abandon it (StrictMode, Suspense,
 * concurrent features). When that happens the tracker created during render
 * is never subscribed to, so it would otherwise leak. This registry disposes
 * abandoned trackers after a timeout.
 *
 * Uses the native FinalizationRegistry when available, with a timer-based
 * sweep as a fallback.
 */

import type { Tracker } from "@fobx/core/internals"

export const REGISTRY_FINALIZE_AFTER = 10_000
export const REGISTRY_SWEEP_INTERVAL = 10_000

interface RegistryEntry {
  tracker: Tracker
  registeredAt: number
}

// ─── Timer-based fallback ─────────────────────────────────────────────────────

class TimerBasedFinalizationRegistry {
  private registrations = new Map<object, RegistryEntry>()
  private sweepTimeout: ReturnType<typeof setTimeout> | undefined

  register(token: object, tracker: Tracker): void {
    this.registrations.set(token, { tracker, registeredAt: Date.now() })
    this.scheduleSweep()
  }

  unregister(token: object): void {
    this.registrations.delete(token)
  }

  private sweep = () => {
    clearTimeout(this.sweepTimeout)
    this.sweepTimeout = undefined

    const now = Date.now()
    this.registrations.forEach((entry, token) => {
      if (now - entry.registeredAt >= REGISTRY_FINALIZE_AFTER) {
        entry.tracker.dispose()
        this.registrations.delete(token)
      }
    })

    if (this.registrations.size > 0) {
      this.scheduleSweep()
    }
  }

  private scheduleSweep(): void {
    if (this.sweepTimeout === undefined) {
      this.sweepTimeout = setTimeout(this.sweep, REGISTRY_SWEEP_INTERVAL)
    }
  }
}

// ─── Native FinalizationRegistry adapter ─────────────────────────────────────

class NativeFinalizationRegistryAdapter {
  private registry: FinalizationRegistry<Tracker>
  private tokens = new Map<object, object>()

  constructor() {
    this.registry = new FinalizationRegistry((tracker: Tracker) => {
      tracker.dispose()
    })
  }

  register(token: object, tracker: Tracker): void {
    this.registry.register(token, tracker, token)
    this.tokens.set(token, token)
  }

  unregister(token: object): void {
    this.registry.unregister(token)
    this.tokens.delete(token)
  }
}

// ─── Export the appropriate implementation ────────────────────────────────────

interface TrackerRegistry {
  register(token: object, tracker: Tracker): void
  unregister(token: object): void
}

export const observerFinalizationRegistry: TrackerRegistry =
  typeof FinalizationRegistry !== "undefined"
    ? new NativeFinalizationRegistryAdapter()
    : new TimerBasedFinalizationRegistry()
