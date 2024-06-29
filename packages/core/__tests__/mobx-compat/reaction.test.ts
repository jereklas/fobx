import * as fobx from "../../src";
import { deepEqual } from "fast-equals";
import { suppressConsole } from "../utils";

beforeAll(() => {
  fobx.configure({ enforceActions: false, comparer: { structural: deepEqual } });
});

test("basic", () => {
  const a = fobx.observable(1);
  const values: number[][] = [];

  const d = fobx.reaction(
    () => a.value,
    (newValue, oldValue) => {
      values.push([newValue, oldValue]);
    }
  );

  a.value = 2;
  a.value = 3;
  d();
  a.value = 4;

  expect(values).toEqual([
    [2, 1],
    [3, 2],
  ]);
});

test("effect fireImmediately is honored", () => {
  const a = fobx.observable(1);
  const values: number[] = [];

  const d = fobx.reaction(
    () => a.value,
    (newValue) => {
      values.push(newValue);
    },
    { fireImmediately: true }
  );

  a.value = 2;
  a.value = 3;
  d();
  a.value = 4;

  expect(values).toEqual([1, 2, 3]);
});

test("effect is untracked", () => {
  const a = fobx.observable(1);
  const b = fobx.observable(2);
  const values: number[] = [];

  const d = fobx.reaction(
    () => a.value,
    (newValue) => {
      values.push(newValue * b.value);
    },
    { fireImmediately: true }
  );

  a.value = 2;
  b.value = 7; // shouldn't trigger a new change
  a.value = 3;
  d();
  a.value = 4;

  expect(values).toEqual([2, 4, 21]);
});

test("passes Reaction as an argument to expression function", () => {
  const a = fobx.observable<number | string>(1);
  const values: (number | string)[] = [];

  fobx.reaction(
    (r) => {
      if (a.value === "pleaseDispose") r.dispose();
      return a.value;
    },
    (newValue) => {
      values.push(newValue);
    },
    { fireImmediately: true }
  );

  a.value = 2;
  a.value = 2;
  a.value = "pleaseDispose";
  a.value = 3;
  a.value = 4;

  expect(values).toEqual([1, 2, "pleaseDispose"]);
});

test("passes Reaction as an argument to effect function", () => {
  const a = fobx.observable<number | string>(1);
  const values: (number | string)[] = [];

  fobx.reaction(
    () => a.value,
    (newValue, _oldValue, r) => {
      if (a.value === "pleaseDispose") r.dispose();
      values.push(newValue);
    },
    { fireImmediately: true }
  );

  a.value = 2;
  a.value = 2;
  a.value = "pleaseDispose";
  a.value = 3;
  a.value = 4;

  expect(values).toEqual([1, 2, "pleaseDispose"]);
});

test("can dispose reaction on first run", () => {
  const a = fobx.observable(1);

  const valuesExpr1st: number[][] = [];
  fobx.reaction(
    () => a.value,
    (newValue, oldValue, r) => {
      r.dispose();
      valuesExpr1st.push([newValue, oldValue]);
    },
    { fireImmediately: true }
  );

  const valuesEffect1st: number[][] = [];
  fobx.reaction(
    (r) => {
      r.dispose();
      return a.value;
    },
    (newValue, oldValue) => {
      valuesEffect1st.push([newValue, oldValue]);
    },
    { fireImmediately: true }
  );

  const valuesExpr: number[][] = [];
  fobx.reaction(
    () => a.value,
    (newValue, oldValue, r) => {
      r.dispose();
      valuesExpr.push([newValue, oldValue]);
    }
  );

  const valuesEffect: number[][] = [];
  fobx.reaction(
    (r) => {
      r.dispose();
      return a.value;
    },
    (newValue, oldValue) => {
      valuesEffect.push([newValue, oldValue]);
    }
  );

  a.value = 2;
  a.value = 3;

  expect(valuesExpr1st).toEqual([[1, undefined]]);
  expect(valuesEffect1st).toEqual([[1, undefined]]);
  expect(valuesExpr).toEqual([[2, 1]]);
  expect(valuesEffect).toEqual([]);
});

// TODO: support AbortSignal disposing?
// test("can dispose reaction with AbortSignal", () => {
//   const a = mobx.observable.box(1)
//   const ac = new AbortController()
//   const values = []

//   reaction(
//       () => a.get(),
//       (newValue, oldValue) => {
//           values.push([newValue, oldValue])
//       },
//       { signal: ac.signal }
//   )

//   a.set(2)
//   a.set(3)
//   ac.abort()
//   a.set(4)

//   expect(values).toEqual([
//       [2, 1],
//       [3, 2]
//   ])
// })

// test("fireImmediately should not be honored when passed already aborted AbortSignal", () => {
//   const a = mobx.observable.box(1)
//   const ac = new AbortController()
//   const values = []

//   ac.abort()

//   reaction(
//       () => a.get(),
//       (newValue) => {
//           values.push(newValue)
//       },
//       { signal: ac.signal, fireImmediately: true }
//   )

//   expect(values).toEqual([])
// })

test("#278 do not rerun if expr output doesn't change", () => {
  const a = fobx.observable(1);
  const values: number[] = [];

  const d = fobx.reaction(
    () => (a.value < 10 ? a.value : 11),
    (newValue) => {
      values.push(newValue);
    }
  );

  a.value = 2;
  a.value = 3;
  a.value = 10;
  a.value = 11;
  a.value = 12;
  a.value = 4;
  a.value = 5;
  a.value = 13;

  d();
  a.value = 4;

  expect(values).toEqual([2, 3, 11, 4, 5, 11]);
});

test("#278 do not rerun if expr output doesn't change structurally", () => {
  const users = fobx.observable([
    {
      name: "jan",
      get uppername(): string {
        return this.name.toUpperCase();
      },
    },
    {
      name: "piet",
      get uppername(): string {
        return this.name.toUpperCase();
      },
    },
  ]);
  const values: string[][] = [];

  const d = fobx.reaction(
    () => users.map((user) => user.uppername),
    (newValue) => {
      values.push(newValue);
    },
    {
      fireImmediately: true,
      comparer: "structural",
    }
  );

  users[0].name = "john";
  users[0].name = "JoHn";
  users[0].name = "jOHN";
  users[1].name = "johan";

  d();
  users[1].name = "w00t";

  expect(values).toEqual([
    ["JAN", "PIET"],
    ["JOHN", "PIET"],
    ["JOHN", "JOHAN"],
  ]);
});

test("do not rerun if prev & next expr output is NaN", () => {
  const v = fobx.observable<string | typeof NaN>("a");
  const values: string[] = [];
  const valuesS: string[] = [];

  const d = fobx.reaction(
    () => v.value,
    (newValue) => {
      values.push(String(newValue));
    },
    { fireImmediately: true }
  );
  const dd = fobx.reaction(
    () => v.value,
    (newValue) => {
      valuesS.push(String(newValue));
    },
    { fireImmediately: true, comparer: "structural" }
  );

  v.value = NaN;
  v.value = NaN;
  v.value = NaN;
  v.value = "b";

  d();
  dd();

  expect(values).toEqual(["a", "NaN", "b"]);
  expect(valuesS).toEqual(["a", "NaN", "b"]);
});

test("reaction uses equals", () => {
  const o = fobx.observable("a");
  const values: string[] = [];
  const disposeReaction = fobx.reaction(
    () => o.value,
    (value) => values.push(value.toLowerCase()),
    { equals: (from, to) => from.toUpperCase() === to.toUpperCase(), fireImmediately: true }
  );
  expect(values).toEqual(["a"]);
  o.value = "A";
  expect(values).toEqual(["a"]);
  o.value = "B";
  expect(values).toEqual(["a", "b"]);
  o.value = "A";
  expect(values).toEqual(["a", "b", "a"]);

  disposeReaction();
});

test("reaction equals function only invoked when necessary", () => {
  suppressConsole(() => {
    const comparisons: { from: string; to: string }[] = [];
    const loggingComparer = (from, to) => {
      comparisons.push({ from, to });
      return from === to;
    };

    const left = fobx.observable("A");
    const right = fobx.observable("B");

    const values: string[] = [];
    const disposeReaction = fobx.reaction(
      // Note: exceptions thrown here are intentional!
      () => left.value.toLowerCase() + right.value.toLowerCase(),
      (value) => values.push(value),
      { equals: loggingComparer, fireImmediately: true }
    );

    // No comparison should be made on the first value
    expect(comparisons).toEqual([]);

    // First change will cause a comparison
    left.value = "C";
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }]);

    // Exception in the reaction expression won't cause a comparison
    // @ts-expect-error - causing exception on purpose
    left.value = null;
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }]);

    // Another exception in the reaction expression won't cause a comparison
    // @ts-expect-error - causing exception on purpose
    right.value = null;
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }]);

    // Transition from exception in the expression will cause a comparison with the last valid value
    left.value = "D";
    right.value = "E";
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
    ]);

    // Another value change will cause a comparison
    right.value = "F";
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
      { from: "de", to: "df" },
    ]);

    expect(values).toEqual(["ab", "cb", "de", "df"]);

    disposeReaction();
  });
});

// TODO: add onReactionError handling
// test("Introduce custom onError for - autorun - 1", () => {
//     let error = ""
//     let globalHandlerCalled = false
//     const d = mobx.onReactionError(() => {
//         globalHandlerCalled = true
//     })
//     expect(() => {
//         mobx.autorun(
//             () => {
//                 throw "OOPS"
//             },
//             {
//                 onError(e) {
//                     error = e
//                 }
//             }
//         )
//     }).not.toThrow()
//     expect(error).toBe("OOPS")
//     expect(globalHandlerCalled).toBe(false)
//     d()
// })

// test("Introduce custom onError for - autorun - 2", done => {
//   let globalHandlerCalled = false
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   expect(() => {
//       mobx.autorun(
//           () => {
//               throw "OOPS"
//           },
//           {
//               delay: 5,
//               onError(error) {
//                   setImmediate(() => {
//                       expect(error).toBe("OOPS")
//                       expect(globalHandlerCalled).toBe(false)
//                       d()
//                       done()
//                   })
//               }
//           }
//       )
//   }).not.toThrow()
// })

// test("Introduce custom onError for - reaction - 1", () => {
//   let error = ""
//   let globalHandlerCalled = false
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   expect(() => {
//       mobx.reaction(
//           () => {
//               throw "OOPS"
//           },
//           () => {},
//           {
//               onError(e) {
//                   error = e
//               }
//           }
//       )
//   }).not.toThrow()
//   expect(error).toBe("OOPS")
//   expect(globalHandlerCalled).toBe(false)
//   d()
// })

// test("Introduce custom onError for - reaction - 2", () => {
//   let error = ""
//   let globalHandlerCalled = false
//   let box = mobx.observable.box(1)
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   mobx.reaction(
//       () => box.get(),
//       () => {
//           throw "OOPS"
//       },
//       {
//           onError(e) {
//               error = e
//           }
//       }
//   )
//   expect(() => {
//       box.set(2)
//   }).not.toThrow()
//   expect(error).toBe("OOPS")
//   expect(globalHandlerCalled).toBe(false)
//   d()
// })

// test("Introduce custom onError for - reaction - 3", done => {
//   let globalHandlerCalled = false
//   let box = mobx.observable.box(1)
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   mobx.reaction(
//       () => box.get(),
//       () => {
//           throw "OOPS"
//       },
//       {
//           delay: 5,
//           onError(e) {
//               expect(e).toBe("OOPS")
//               setImmediate(() => {
//                   expect(globalHandlerCalled).toBe(false)
//                   d()
//                   done()
//               })
//           }
//       }
//   )
//   expect(() => {
//       box.set(2)
//   }).not.toThrow()
// })

// test("Introduce custom onError for - when - 1", () => {
//   let error = ""
//   let globalHandlerCalled = false
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   expect(() => {
//       mobx.when(
//           () => {
//               throw "OOPS"
//           },
//           () => {},
//           {
//               onError(e) {
//                   error = e
//               }
//           }
//       )
//   }).not.toThrow()
//   expect(error).toBe("OOPS")
//   expect(globalHandlerCalled).toBe(false)
//   d()
// })

// test("Introduce custom onError for - when - 2", () => {
//   let error = ""
//   let globalHandlerCalled = false
//   let box = mobx.observable.box(1)
//   const d = mobx.onReactionError(() => {
//       globalHandlerCalled = true
//   })
//   mobx.when(
//       () => box.get() === 2,
//       () => {
//           throw "OOPS"
//       },
//       {
//           onError(e) {
//               error = e
//           }
//       }
//   )
//   expect(() => {
//       box.set(2)
//   }).not.toThrow()
//   expect(error).toBe("OOPS")
//   expect(globalHandlerCalled).toBe(false)
//   d()
// })
