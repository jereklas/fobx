// deno-lint-ignore-file no-explicit-any
import * as fobx from "../../index.ts"
import {
  beforeEach,
  describe,
  expect,
  FakeTime,
  suppressConsole,
  test,
} from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceTransactions: false })
})

// ─── Subscription timing ──────────────────────────────────────────────────────

describe("autorun subscriptions happen at end of the autorun body", () => {
  test("autorun with observable", () => {
    const o = fobx.observableBox(0)
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
    const o = fobx.observableBox(0)
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
    const o = fobx.observableBox(0)
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
    const o = fobx.observableBox(0)
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

// ─── Dispose mechanism ────────────────────────────────────────────────────────

test("autorun passes Dispose function as an argument to view function", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  fobx.autorun((dispose) => {
    expect(typeof dispose).toBe("function")
    if (a.get() === 3) {
      dispose()
    }
    values.push(a.get())
  })

  a.set(2)
  a.set(2)
  a.set(3)
  a.set(4)

  expect(values).toEqual([1, 2, 3])
})

test("autorun can be disposed on first run", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  fobx.autorun((dispose) => {
    dispose()
    values.push(a.get())
  })

  a.set(2)

  expect(values).toEqual([1])
})

// ─── Error handling ───────────────────────────────────────────────────────────

test("autorun warns when passed an action", () => {
  const act = fobx.transaction(() => {})
  expect(() => fobx.autorun(act)).toThrow(
    "[@fobx/core] Autorun cannot have a transaction as the tracked function.",
  )
})

// ─── Batching ─────────────────────────────────────────────────────────────────

test("autorun batches automatically", () => {
  let runs = 0
  let a1runs = 0
  let a2runs = 0

  const x = fobx.observable({
    a: 1,
    b: 1,
    c: 1,
    get d() {
      runs++
      return this.c + this.b
    },
  })

  const d1 = fobx.autorun(() => {
    a1runs++
    x.d // read
  })

  const d2 = fobx.autorun(() => {
    a2runs++
    x.b = x.a
    x.c = x.a
  })

  expect(a1runs).toBe(1)
  expect(a2runs).toBe(1)
  expect(runs).toBe(1)

  x.a = 17

  expect(a1runs).toBe(2)
  expect(a2runs).toBe(2)
  expect(runs).toBe(2)

  d1()
  d2()
})

test("autorun tracks invalidation of unbound dependencies", () => {
  const a = fobx.observableBox(0)
  const b = fobx.observableBox(0)
  const c = fobx.computed(() => a.get() + b.get())
  const values: number[] = []

  fobx.autorun(() => {
    values.push(c.get())
    b.set(100)
  })

  a.set(1)
  expect(values).toEqual([0, 100, 101])
})

test("when effect is an action", async () => {
  using time = new FakeTime()
  const a = fobx.observableBox(0)

  let messages

  fobx.when(
    () => a.get() === 1,
    () => {
      messages = suppressConsole(() => {
        a.set(2)
      })
    },
    { timeout: 1 },
  )

  fobx.runInTransaction(() => {
    a.set(1)
  })
  await time.runAllAsync()

  expect(messages).toEqual([])
})

// ─── Complex autorun interactions ─────────────────────────────────────────────

//cspell:ignore autoruns
test("autoruns created in autoruns should kick off", function () {
  const x = fobx.observableBox(3)
  const x2: unknown[] = []
  let d: (() => void) | undefined

  fobx.autorun(function () {
    if (d) {
      // this shouldn't ever run because x is tracked by the inner autorun
      x2.push("disposed")
      d()
    }
    d = fobx.autorun(function () {
      x2.push(x.get() * 2)
    })
  })

  x.set(4)
  expect(x2).toEqual([6, 8])
})

test("nested autorun setup preserves immediate execution order", () => {
  const values: number[] = []
  let innerDispose: (() => void) | undefined

  const outerDispose = fobx.autorun(() => {
    innerDispose = fobx.autorun(() => {
      values.push(1)
    })
    values.push(2)
  })

  expect(values).toEqual([1, 2])

  outerDispose()
  innerDispose?.()
})

test("observed writes inside autorun still warn outside transaction", () => {
  fobx.configure({ enforceTransactions: true })

  const a = fobx.observableBox(0)
  const b = fobx.observableBox(0)
  const warnings: string[] = []
  const originalWarn = console.warn

  const disposeA = fobx.autorun(() => {
    a.get()
  })
  const disposeB = fobx.autorun(() => {
    b.get()
  })
  const disposeMutator = fobx.autorun(() => {
    if (a.get() === 1) {
      b.set(1)
    }
  })

  try {
    console.warn = (message?: unknown) => {
      warnings.push(String(message))
    }

    a.set(1)

    expect(b.get()).toBe(1)
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/outside of a transaction/)
    expect(warnings[1]).toMatch(/outside of a transaction/)
  } finally {
    console.warn = originalWarn
    disposeA()
    disposeB()
    disposeMutator()
    fobx.configure({ enforceTransactions: false })
  }
})

test("prematurely end autorun", function () {
  const x = fobx.observableBox(2)
  let dis1: (() => void) | undefined
  let dis2: (() => void) | undefined
  let r1: unknown
  let r2: unknown

  fobx.runInTransaction(function () {
    dis1 = fobx.autorun(function (r) {
      r1 = r
      x.get()
    })
    dis2 = fobx.autorun(function (r) {
      r2 = r
      x.get()
    })

    // neither autorun runs while inside the transaction
    expect(r1).toBe(undefined)
    expect(r2).toBe(undefined)

    dis1!()
  })
  // After transaction, dis2's autorun should have run and be active
  expect(r2).not.toBe(undefined)
  // dis1 was disposed so it shouldn't have run
  expect(r1).toBe(undefined)
  dis2!()
})

test("prematurely ended autoruns are cleaned up properly", () => {
  const a = fobx.observableBox(1)
  const b = fobx.observableBox(2)
  const c = fobx.observableBox(3)
  let called = 0

  fobx.autorun((dispose) => {
    called++
    if (a.get() === 2) {
      dispose() // dispose
      b.get() // consume
      a.set(3) // cause itself to re-run, but, disposed!
    } else {
      c.get()
    }
  })

  expect(called).toBe(1)

  a.set(2)

  expect(called).toBe(2)

  // none of the read boxes causes a re-run anymore
  a.set(3)
  b.set(1)
  c.set(1)
  expect(called).toBe(2)
})

test("un-optimizable subscriptions are diffed correctly", () => {
  const a = fobx.observableBox(1)
  const b = fobx.observableBox(1)
  const c = fobx.computed(() => {
    a.get()
    return 3
  })
  let called = 0
  let val = 0

  const d = fobx.autorun(() => {
    called++
    a.get()
    c.get() // reads a as well
    val = a.get()
    if (
      b.get() === 1 // only on first run
    ) {
      a.get() // second run: one read less for a
    }
  })

  expect(called).toBe(1)
  expect(val).toBe(1)

  b.set(2)

  expect(called).toBe(2)
  expect(val).toBe(1)

  a.set(2)

  expect(called).toBe(3)
  expect(val).toBe(2)

  d()
})

test("eval in transaction", function () {
  let bCalcs = 0
  const x = fobx.observable({
    a: 1,
    get b() {
      bCalcs++
      return this.a * 2
    },
  })
  let c: number | undefined

  fobx.autorun(function () {
    c = x.b
  })

  expect(bCalcs).toBe(1)
  expect(c).toBe(2)

  fobx.runInTransaction(function () {
    x.a = 3
    expect(x.b).toBe(6)
    expect(bCalcs).toBe(2)
    expect(c).toBe(2)

    x.a = 4
    expect(x.b).toBe(8)
    expect(bCalcs).toBe(3)
    expect(c).toBe(2)
  })
  expect(bCalcs).toBe(3) // 2 or 3 would be fine as well
  expect(c).toBe(8)
})

// ─── Cascading active state ───────────────────────────────────────────────────

test("cascading active state (form 1)", function () {
  const Store = function (this: any) {
    this._activeItem = null
    fobx.makeObservable(this, { annotations: { _activeItem: "observable" } })
  }
  Store.prototype.activeItem = function (item: unknown) {
    // deno-lint-ignore no-this-alias
    const _this = this

    if (arguments.length === 0) return this._activeItem

    fobx.runInTransaction(function () {
      if (_this._activeItem === item) return
      if (_this._activeItem) _this._activeItem.isActive = false
      _this._activeItem = item
      if (_this._activeItem) _this._activeItem.isActive = true
    })
  }

  const Item = function (this: any) {
    this.isActive = false
    fobx.makeObservable(this, { annotations: { isActive: "observable" } })
  }

  //@ts-expect-error - testing
  const store = new Store()
  //@ts-expect-error - testing
  const item1 = new Item()
  //@ts-expect-error - testing
  const item2 = new Item()
  expect(store.activeItem()).toBe(null)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(false)

  store.activeItem(item1)
  expect(store.activeItem()).toBe(item1)
  expect(item1.isActive).toBe(true)
  expect(item2.isActive).toBe(false)

  store.activeItem(item2)
  expect(store.activeItem()).toBe(item2)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(true)

  store.activeItem(null)
  expect(store.activeItem()).toBe(null)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(false)
})

test("cascading active state (form 2)", function () {
  const Store = function (this: any) {
    // deno-lint-ignore no-this-alias
    const _this = this
    this.activeItem = null
    fobx.makeObservable(this, { annotations: { activeItem: "observable" } })

    fobx.autorun(function () {
      if (_this._activeItem === _this.activeItem) return
      if (_this._activeItem) _this._activeItem.isActive = false
      _this._activeItem = _this.activeItem
      if (_this._activeItem) _this._activeItem.isActive = true
    })
  }

  const Item = function (this: any) {
    this.isActive = false
    fobx.makeObservable(this, { annotations: { isActive: "observable" } })
  }

  //@ts-expect-error - testing
  const store = new Store()
  //@ts-expect-error - testing
  const item1 = new Item()
  //@ts-expect-error - testing
  const item2 = new Item()
  expect(store.activeItem).toBe(null)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(false)

  store.activeItem = item1
  expect(store.activeItem).toBe(item1)
  expect(item1.isActive).toBe(true)
  expect(item2.isActive).toBe(false)

  store.activeItem = item2
  expect(store.activeItem).toBe(item2)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(true)

  store.activeItem = null
  expect(store.activeItem).toBe(null)
  expect(item1.isActive).toBe(false)
  expect(item2.isActive).toBe(false)
})

test("efficient selection", function () {
  function Item(this: any, value: number) {
    this.selected = false
    this.value = value
    fobx.makeObservable(this, {
      annotations: { selected: "observable", value: "observable" },
    })
  }

  function Store(this: any) {
    this.prevSelection = null
    this.selection = null
    //@ts-expect-error - testing
    this.items = [new Item(1), new Item(2), new Item(3)]
    fobx.makeObservable(this, {
      annotations: { selection: "observable", items: "observable" },
    })
    fobx.autorun(() => {
      if (this.previousSelection === this.selection) return true // converging condition
      if (this.previousSelection) this.previousSelection.selected = false
      if (this.selection) this.selection.selected = true
      this.previousSelection = this.selection
    })
  }

  //@ts-expect-error - testing
  const store = new Store()

  expect(store.selection).toBe(null)
  expect(
    store.items.filter(function (i: any) {
      return i.selected
    }).length,
  ).toBe(0)

  store.selection = store.items[1]
  expect(
    store.items.filter(function (i: any) {
      return i.selected
    }).length,
  ).toBe(1)
  expect(store.selection).toBe(store.items[1])
  expect(store.items[1].selected).toBe(true)

  store.selection = store.items[2]
  expect(
    store.items.filter(function (i: any) {
      return i.selected
    }).length,
  ).toBe(1)
  expect(store.selection).toBe(store.items[2])
  expect(store.items[2].selected).toBe(true)

  store.selection = null
  expect(
    store.items.filter(function (i: any) {
      return i.selected
    }).length,
  ).toBe(0)
  expect(store.selection).toBe(null)
})

// ─── Nested computeds ─────────────────────────────────────────────────────────

//cspell:ignore computeds
test("nested computeds should not run unnecessary", () => {
  function Item(this: any, name: string) {
    this.name = name
    Object.defineProperty(this, "index", {
      get() {
        const i = store.items.indexOf(this)
        if (i === -1) {
          throw "not found"
        }
        return i
      },
      enumerable: true,
      configurable: true,
    })
    fobx.makeObservable(this, {
      annotations: { name: "observable", index: "computed" },
    })
  }

  const store = fobx.observable({
    items: [] as unknown as fobx.ObservableArray<any>,
    get asString(): string {
      return this.items.map((item) => item.index + ":" + item.name).join(",")
    },
  })
  //@ts-expect-error - testing
  store.items.push(new Item("item1"))

  const values: string[] = []
  fobx.autorun(() => {
    values.push(store.asString)
  })
  //@ts-expect-error - testing
  store.items.replace([new Item("item2")])

  expect(values).toEqual(["0:item1", "0:item2"])
})

test("stale observables should not cause issues after brokenIncrement pattern", () => {
  using time = new FakeTime()
  const snapshots: string[] = []

  const x = fobx.observableBox(1)

  const derived1 = fobx.computed(() => {
    return x.get() + 1
  })

  const derived2 = fobx.computed(() => {
    return derived1.get() + 1
  })

  function increment() {
    fobx.runInTransaction(() => {
      x.set(x.get() + 1)
      derived1.get()
      derived2.get()
    })
  }

  function brokenIncrement() {
    fobx.runInTransaction(() => x.set(x.get() + 1))
    derived1.get()
    derived2.get()
  }

  fobx.autorun(() => {
    snapshots.push(`${x.get()}, ${derived1.get()}, ${derived2.get()}`)
  })

  increment()
  setTimeout(() => {
    brokenIncrement()
  }, 50)
  setTimeout(() => {
    expect(snapshots).toEqual(["1, 2, 3", "2, 3, 4", "3, 4, 5"])
  }, 100)
  time.tick(100)
})

// ─── Complex when + autorun scenarios ────────────────────────────────────────

test("issue 71, transacting running transformation", function () {
  const state = fobx.observable({
    things: [] as any[],
  })

  function Thing(this: any, value: number) {
    this.value = value
    Object.defineProperty(this, "pos", {
      get() {
        return state.things.indexOf(this)
      },
      enumerable: true,
      configurable: true,
    })
    Object.defineProperty(this, "isVisible", {
      get() {
        return this.pos !== -1
      },
      enumerable: true,
      configurable: true,
    })
    fobx.makeObservable(this, {
      annotations: {
        value: "observable",
        pos: "computed",
        isVisible: "computed",
      },
    })

    fobx.when(
      () => {
        return this.isVisible
      },
      () => {
        if (this.pos < 4) {
          // @ts-expect-error - testing
          state.things.push(new Thing(value + 1))
        }
      },
    )
  }

  let copy: number[]
  let vSum: number
  fobx.autorun(function () {
    copy = state.things.map(function (thing) {
      return thing.value
    })
    vSum = state.things.reduce(function (a, thing) {
      return a + thing.value
    }, 0)
  })

  expect(copy!).toEqual([])

  fobx.runInTransaction(function () {
    // @ts-expect-error - testing
    state.things.push(new Thing(1))
  })

  expect(copy!).toEqual([1, 2, 3, 4, 5])
  expect(vSum!).toBe(15)

  state.things.splice(0, 2)
  // @ts-expect-error - testing
  state.things.push(new Thing(6))

  expect(copy!).toEqual([3, 4, 5, 6, 7])
  expect(vSum!).toBe(25)
})
