import * as fobx from "../../index.ts"
import { beforeAll, expect, FakeTime, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

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

test("fix #1535: stale observables", () => {
  using time = new FakeTime()
  // see https://codesandbox.io/s/k92o2jmz63
  const snapshots: string[] = []

  const x = fobx.box(1)

  // Depends on observable x
  const derived1 = fobx.computed(() => {
    return x.get() + 1
  })

  // Depends on computed derived1
  const derived2 = fobx.computed(() => {
    return derived1.get() + 1
  })

  function increment() {
    fobx.runInTransaction(() => {
      x.set(x.get() + 1)
      // No problems here
      derived1.get()
      derived2.get()
    })
  }

  function brokenIncrement() {
    fobx.runInTransaction(() => x.set(x.get() + 1))
    // Accessing computed outside of action causes staleness
    // NOTE IT DOESN'T MATTER WHICH COMPUTED IS ACCESSED
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
