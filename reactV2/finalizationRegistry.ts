/**
 * Timer-based finalization registry for observer reactions.
 *
 * React can render a component and then abandon it (StrictMode, Suspense,
 * concurrent features). During render, we create a Tracker to track deps.
 * If the component never mounts, the subscribe callback never runs, and the
 * tracker would leak. This registry disposes abandoned trackers after a timeout.
 *
 * When available, native FinalizationRegistry is used. Otherwise falls back
 * to a timer-based sweep.
 */

import type { Tracker } from "@fobx/v2"

export const REGISTRY_FINALIZE_AFTER = 10_000
export const REGISTRY_SWEEP_INTERVAL = 10_000

interface RegistryEntry {
  tracker: Tracker
  registeredAt: number
}

// ─── Timer-based fallback ────────────────────────────────────────────────────

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
    // Use a weak ref token so GC can collect abandoned admRef objects
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
