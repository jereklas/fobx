// @ts-ignore - to suppress tsc false error
import type { Reaction } from "@fobx/core"

export const REGISTRY_FINALIZE_AFTER = 10_000
export const REGISTRY_SWEEP_INTERVAL = 10_000

type RegistryValue = { reaction: Reaction | null }
const registrations = new Map<RegistryValue, number>()

let sweepTimeout: ReturnType<typeof setTimeout> | undefined

const sweep = () => {
  clearTimeout(sweepTimeout)
  sweepTimeout = undefined

  const now = Date.now()
  registrations.forEach((registeredAt, adm) => {
    if (now - registeredAt >= REGISTRY_FINALIZE_AFTER) {
      adm.reaction?.dispose()
      adm.reaction = null
      registrations.delete(adm)
    }
  })

  if (registrations.size > 0) {
    scheduleSweep()
  }
}

const scheduleSweep = () => {
  if (sweepTimeout === null) {
    sweepTimeout = setTimeout(sweep, REGISTRY_SWEEP_INTERVAL)
  }
}

export const observerFinalizationRegistry = {
  register(adm: RegistryValue) {
    registrations.set(adm, Date.now())
    scheduleSweep()
  },
  unregister(adm: RegistryValue) {
    registrations.delete(adm)
  },
}
