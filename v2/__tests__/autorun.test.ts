import * as fobx from "../index.ts"
import { beforeAll, describe, expect, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

describe("autorun subscriptions happen at end of the autorun body", () => {
  test("autorun with observable", () => {
    const o = fobx.box(0)
    const seen: number[] = []

    fobx.autorun(() => {
      seen.push(o.get())
      if (o.get() < 5) o.set(o.get() + 1)
    })
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toEqual([0, 1, 2, 3, 4, 5])

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.set(o.get() + 1)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  test("autorun with computed", () => {
    const o = fobx.box(0)
    const c = fobx.computed(
      () => o.get(),
      {
        set: (v: number) => {
          o.set(v)
        },
      },
    )
    const seen: number[] = []

    // make sure computed doesn't behave differently than observables with respect to subscription
    fobx.autorun(() => {
      seen.push(c.get())
      if (c.get() < 5) c.set(c.get() + 1)
    })
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toEqual([0, 1, 2, 3, 4, 5])

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.set(o.get() + 1)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  test("autorun with observables inside of a transaction", () => {
    const o = fobx.box(0)
    const seen: number[] = []

    // autorun created inside of transaction behaves the same as one created outside of a transaction
    fobx.runInTransaction(() => {
      fobx.autorun(() => {
        seen.push(o.get())
        if (o.get() < 5) o.set(o.get() + 1)
      })
    })

    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toEqual([0, 1, 2, 3, 4, 5])

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.set(o.get() + 1)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  test("autorun with computed inside of a transaction", () => {
    const o = fobx.box(0)
    const c = fobx.computed(
      () => o.get(),
      {
        set: (v: number) => {
          o.set(v)
        },
      },
    )
    const seen: number[] = []

    // autorun created inside of transaction
    fobx.runInTransaction(() => {
      fobx.autorun(() => {
        seen.push(c.get())
        if (c.get() < 5) c.set(c.get() + 1)
      })
    })
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toEqual([0, 1, 2, 3, 4, 5])

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.set(o.get() + 1)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
