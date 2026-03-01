/**
 * Tests from @fobx/core that CANNOT be ported to v2 due to architectural differences.
 * Each test is commented out with an explanation of why it can't be ported.
 *
 * Categories:
 *   1. Flow tests (11 tests) — v2 does not have flow
 *   2. verify #2519 (1 test) — uses flow
 *   3. observableObject type-check tests (3 tests) — v2 routes collections to constructors instead of throwing
 *   4. Internal API tests (3 tests) — v2 doesn't expose ReactionWithoutBatch, runReactions, startAction/endAction
 */

// ─── FLOW TESTS ──────────────────────────────────────────────────────────────
// v2 does not implement flow. Generator functions on observable classes are
// treated as transactions in v2 rather than async flow wrappers.
// Source: core/__tests__/mobx-compat/flow.test.ts

// function delay<T>(time: number, value: T, shouldThrow = false) {
//   return new Promise<T>((resolve, reject) => {
//     setTimeout(() => {
//       if (shouldThrow) reject(value)
//       else resolve(value)
//     }, time)
//   })
// }

// test("it should support async generator actions", async () => {
//   const values: number[] = []
//   const x = fobx.observable({ a: 1 })
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const f = fobx.flow(function* (initial: number) {
//     x.a = initial // this runs in action
//     x.a = (yield delay(10, 3)) as number // and this as well!
//     yield delay(10, 0)
//     x.a = 4
//     return x.a
//   })
//
//   const result = await f(2)
//   expect(result).toBe(4)
//   expect(values).toEqual([1, 2, 3, 4])
// })

// test("it should support try catch in async generator", async () => {
//   const values: number[] = []
//   const x = fobx.observable({ a: 1 })
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const f = fobx.flow(function* (initial) {
//     x.a = initial // this runs in action
//     try {
//       x.a = (yield delay(10, 5, true)) as number // and this as well!
//       yield delay(10, 0)
//       x.a = 4
//     } catch (e) {
//       x.a = e as number
//     }
//     return x.a
//   })
//
//   const v = await f(2)
//   expect(v).toBe(5)
//   expect(values).toEqual([1, 2, 5])
// })

// test("it should support throw from async generator", () => {
//   return fobx
//     .flow(function* () {
//       yield "a"
//       throw 7
//     })()
//     .then(
//       () => {
//         expect("").toBe("should fail test if this case hits")
//       },
//       (e) => {
//         expect(e).toBe(7)
//       },
//     )
// })

// test("it should support throw from yielded promise generator", () => {
//   return fobx
//     .flow(function* () {
//       return yield delay(10, 7, true)
//     })()
//     .then(
//       () => {
//         expect("").toBe("should fail test if this case hits")
//       },
//       (e) => {
//         expect(e).toBe(7)
//       },
//     )
// })

// test("flow function as instance member of class", async () => {
//   const values: number[] = []
//
//   class X {
//     a = 1
//
//     f = fobx.flow(function* (this: X, initial: number) {
//       this.a = initial // this runs in action
//       try {
//         this.a = yield delay(10, 5, true) // and this as well!
//         yield delay(10, 0)
//         this.a = 4
//       } catch (e) {
//         this.a = e as number
//       }
//       return this.a
//     })
//     constructor() {
//       fobx.observable(this)
//     }
//   }
//   const x = new X()
//   expect(fobx.isAction(x.f)).toBe(false)
//   expect(fobx.isFlow(x.f)).toBe(true)
//
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const v = await x.f(2)
//   expect(v).toBe(5)
//   expect(x.a).toBe(5)
//   expect(values).toEqual([1, 2, 5])
// })

// test("flow function on class prototype", async () => {
//   const values: number[] = []
//
//   class X {
//     a = 1;
//
//     *f(initial: number) {
//       this.a = initial // this runs in action
//       try {
//         this.a = yield delay(10, 5, true) // and this as well!
//         yield delay(10, 0)
//         this.a = 4
//       } catch (e) {
//         this.a = e as number
//       }
//       return this.a
//     }
//
//     constructor() {
//       fobx.observable(this)
//     }
//   }
//   const x = new X()
//   expect(fobx.isAction(x.f)).toBe(false)
//   expect(fobx.isFlow(x.f)).toBe(true)
//
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const v = await x.f(2)
//   expect(v).toBe(5)
//   expect(x.a).toBe(5)
//   expect(values).toEqual([1, 2, 5])
// })

// test("flows yield anything", async () => {
//   const start = fobx.flow(function* () {
//     const x = yield 2
//     return x
//   })
//
//   const res = await start()
//   expect(res).toBe(2)
// })

// test("it should support explicit flow annotation", async () => {
//   const values: number[] = []
//
//   class X {
//     a = 1
//
//     f = function* (this: X, initial: number) {
//       this.a = initial // this runs in action
//       try {
//         this.a = yield delay(100, 5, true) // and this as well!
//         yield delay(100, 0)
//         this.a = 4
//       } catch (e) {
//         this.a = e as number
//       }
//       return this.a
//     }
//     constructor() {
//       fobx.observable(this, {
//         f: "flow",
//       })
//     }
//   }
//
//   const x = new X()
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const x2 = new X()
//   expect(x2.f).not.toBe(x.f) // local field!
//
//   const v = await x.f(2)
//   expect(v).toBe(5)
//   expect(values).toEqual([1, 2, 5])
//   expect(x.a).toBe(5)
// })

// test("it should support implicit flow annotation", async () => {
//   const values: number[] = []
//
//   class X {
//     a = 1;
//
//     *f(initial: number) {
//       this.a = initial // this runs in action
//       try {
//         this.a = yield delay(100, 5, true) // and this as well!
//         yield delay(100, 0)
//         this.a = 4
//       } catch (e) {
//         this.a = e as number
//       }
//       return this.a
//     }
//
//     constructor() {
//       fobx.observable(this)
//     }
//   }
//
//   const x = new X()
//   expect(fobx.isFlow(X.prototype.f)).toBe(true)
//   expect(Object.getOwnPropertyDescriptor(x, "f")).toBe(undefined)
//
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const v = await x.f(2)
//   expect(v).toBe(5)
//   expect(values).toEqual([1, 2, 5])
//   expect(x.a).toBe(5)
// })

// test("flow is called with correct context", async () => {
//   const thisArg = {}
//   const f = fobx.flow(function* (this: object) {
//     yield delay(10, 0)
//     expect(this).toBe(thisArg)
//   })
//   await f.call(thisArg)
// })

// ─── FLOW: named generator ───────────────────────────────────────────────────
// Source: core/transactions/__tests__/flow.test.ts

// test("named generator functions supplied to flow is retained", () => {
//   const f = fobx.flow(function* something() {
//     yield Promise.resolve()
//   })
//
//   expect(f.name).toBe("something")
// })

// ─── FLOW: verify #2519 ─────────────────────────────────────────────────────
// This test uses fobx.flow which doesn't exist in v2.
// Source: core/__tests__/mobx-compat/flow.test.ts

// test("verify #2519", async () => {
//   const values: number[] = []
//   const x = fobx.observable({ a: 1 })
//   fobx.reaction(
//     () => x.a,
//     (v) => values.push(v),
//     { fireImmediately: true },
//   )
//
//   const f = fobx.flow(function* (initial: number) {
//     x.a = initial // this runs in action
//     try {
//       x.a = (yield delay(10, 5, false)) as number // and this as well!
//       yield delay(10, 0)
//       x.a = 4
//     } catch (e) {
//       x.a = e as number
//     }
//     return x.a
//   })
//
//   const v = await f(2)
//
//   expect(v).toBe(4)
//   expect(values).toEqual([1, 2, 5, 4])
// })

// ─── OBSERVABLE OBJECT TYPE-CHECK TESTS ──────────────────────────────────────
// v2's observable() routes arrays, Maps, and Sets to their respective collection
// constructors (array(), map(), set()) instead of throwing an error.
// Source: core/observables/__tests__/observableObject.test.ts

// test("throws error if supplied type of 'array'", () => {
//   expect(() => createAutoObservableObject([])).toThrow(
//     '[@fobx/core] Cannot make an observable object out of type "array"',
//   )
// })

// test("throws error if supplied type of 'map'", () => {
//   expect(() => createAutoObservableObject(new Map())).toThrow(
//     '[@fobx/core] Cannot make an observable object out of type "map"',
//   )
// })

// test("throws error if supplied type of 'set'", () => {
//   expect(() => createAutoObservableObject(new Set())).toThrow(
//     '[@fobx/core] Cannot make an observable object out of type "set"',
//   )
// })

// ─── INTERNAL API TESTS ─────────────────────────────────────────────────────
// These test internal APIs that are not exposed in v2.

// --- ReactionWithoutBatch ---
// v2 does not have a ReactionWithoutBatch class.
// Source: core/reactions/__tests__/reaction.test.ts

// test("The non batching reaction runs as expected", () => {
//   const a = fobx.observableBox(0)
//   let called = -1
//   const reaction = new ReactionWithoutBatch(new fobx.ReactionAdmin(() => run()))
//
//   const run = () => {
//     reaction.track(() => {
//       called += 1
//       a.value
//     })
//   }
//   run()
//   expect(called).toBe(0)
//
//   a.value += 1
//   expect(called).toBe(1)
// })

// --- runReactions ---
// v2's runPendingReactions is private and doesn't have a canRun() guard per reaction.
// Source: core/reactions/__tests__/reaction.test.ts

// test("runReactions issues message to stderr if reactions can't run", () => {
//   const mock = fn()
//   let r!: ReactionWithAdmin
//   fobx.reaction((re) => {
//     r = re as ReactionWithAdmin
//   }, mock)
//   expect(mock).not.toHaveBeenCalled()
//
//   const adm = r[$fobx]
//   adm.canRun = () => false
//
//   globalState.pendingReactions.push(adm)
//   expect(globalState.pendingReactions.length).toBe(1)
//
//   expect(
//     grabConsole(() => {
//       runReactions()
//     }),
//   ).toEqual(
//     "<STDERR> [@fobx/core] Failed to run all reactions. This typically means a bad circular reaction.",
//   )
// })

// --- startAction / endAction ---
// v2 uses a different batch API (startBatch/endBatch) without the same
// out-of-order validation that core's startAction/endAction provides.
// Source: core/__tests__/mobx-compat/action.test.ts

// test("out of order startAction / endAction", () => {
//   // no action has started
//   expect(() => endAction()).toThrow("invalid endAction call")
//
//   // action has started, but 2 endAction calls occurs
//   startAction()
//   endAction()
//   expect(() => endAction()).toThrow("invalid endAction call")
// })
