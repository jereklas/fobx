// Notification propagation functions - OPTIMIZED

import { $global } from "./global.ts"
import type { ComputedAdmin, ObservableAdmin } from "./types.ts"
import { NotificationType, ReactionState } from "./types.ts"

/**
 * Sends notifications to all observers of an observable
 * PERF: This runs on every observable write with observers - CRITICAL HOT PATH
 *
 * OPTIMIZED: Inlined handleNotification logic to eliminate function call overhead
 */
export function notifyObservers(
  observable: ObservableAdmin,
  notificationType: NotificationType,
): void {
  const observers = observable.observers
  const length = observers.length

  // PERF: Inline notification logic - eliminates function call per observer
  for (let i = 0; i < length; i++) {
    const reaction = observers[i]

    // CRITICAL: Skip the currently executing reaction to prevent re-queuing itself
    // A reaction should not be notified of changes it's causing while it's running
    if (reaction === $global.tracking) {
      continue
    }

    const state = reaction.state

    if (
      state === ReactionState.STALE || state === ReactionState.POSSIBLY_STALE
    ) {
      // Upgrade to STALE if receiving CHANGED notification
      if (notificationType === NotificationType.CHANGED) {
        reaction.state = ReactionState.STALE
      }
      // Short circuit - already in pending queue, already propagated downstream
      continue
    } else if (state === ReactionState.UP_TO_DATE) {
      // Transition state based on notification type
      reaction.state = notificationType === NotificationType.CHANGED
        ? ReactionState.STALE
        : ReactionState.POSSIBLY_STALE

      // CRITICAL: Only queue reactions with observers (don't queue suspended computeds)
      // A computed with no observers should not be re-run just because dependency changed
      const isComputed = "observers" in reaction
      const hasobservers = isComputed
        ? (reaction as ComputedAdmin).observers.length > 0
        : true

      if (hasobservers) {
        // Add to pending queue
        $global.pending.push(reaction)
      }

      // PERF: Check if this is a computed (has observers property) to propagate
      if (isComputed && hasobservers) {
        notifyObservers(
          reaction as unknown as ObservableAdmin,
          NotificationType.INDETERMINATE,
        )
      }
    }
  }
}
