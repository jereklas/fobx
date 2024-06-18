import * as fobx from "../../src";
import { grabConsole } from "../utils";
import * as iterall from "iterall";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

test("test1", function () {
  const a = fobx.observable<number>([]);
  expect(a.length).toBe(0);
  expect(Object.keys(a)).toEqual([]);
  expect(a.slice()).toEqual([]);

  a.push(1);
  expect(a.length).toBe(1);
  expect(a.slice()).toEqual([1]);

  a[1] = 2;
  expect(a.length).toBe(2);
  expect(a.slice()).toEqual([1, 2]);

  const sum = fobx.computed(function () {
    return a.reduce((a, b) => a + b, 0);
  });

  expect(sum.value).toBe(3);

  a[1] = 3;
  expect(a.length).toBe(2);
  expect(a.slice()).toEqual([1, 3]);
  expect(sum.value).toBe(4);

  a.splice(1, 1, 4, 5);
  expect(a.length).toBe(3);
  expect(a.slice()).toEqual([1, 4, 5]);
  expect(sum.value).toBe(10);

  a.replace([2, 4]);
  expect(a).toStrictEqual([2, 4]);
  expect(sum.value).toBe(6);

  a.splice(1, 1);
  expect(sum.value).toBe(2);
  expect(a.slice()).toEqual([2]);

  a.splice(0, 0, 4, 3);
  expect(sum.value).toBe(9);
  expect(a.slice()).toEqual([4, 3, 2]);

  a.length = 0;
  expect(sum.value).toBe(0);
  expect(a.slice()).toEqual([]);

  a.length = 4;
  expect(sum.value).toBe(0);
  expect(a.length).toEqual(4);

  expect(a.slice()).toEqual([undefined, undefined, undefined, undefined]);

  a.replace([1, 2, 2, 4]);
  expect(sum.value).toBe(9);
  a.length = 4;
  expect(sum.value).toBe(9);

  a.length = 2;
  expect(sum.value).toBe(3);
  expect(a.slice()).toEqual([1, 2]);

  expect(a.reverse()).toEqual([2, 1]);
  expect(a).toEqual([2, 1]);
  expect(a.slice()).toEqual([2, 1]);

  a.unshift(3);
  expect(a.sort()).toEqual([1, 2, 3]);
  expect(a).toEqual([1, 2, 3]);
  expect(a.slice()).toEqual([1, 2, 3]);

  expect(JSON.stringify(a)).toBe("[1,2,3]");

  expect(a[1]).toBe(2);
  a[2] = 4;
  expect(a[2]).toBe(4);

  expect(Object.keys(a)).toEqual(["0", "1", "2"]);
});

test("cannot reverse or sort an array in a derivation", () => {
  const ar = fobx.observable([3, 2, 1]);
  let msg;

  msg = grabConsole(() => {
    fobx.reaction(
      () => {
        ar.sort();
      },
      () => {}
    )();
  });

  expect(ar).toStrictEqual([3, 2, 1]);
  expect(msg).toMatch(/<STDERR> \[@fobx\/core\] "Reaction@.*" threw an exception/);

  msg = grabConsole(() => {
    fobx.reaction(
      () => {
        ar.reverse();
      },
      () => {}
    )();
  });
  expect(ar).toStrictEqual([3, 2, 1]);
  expect(msg).toMatch(/<STDERR> \[@fobx\/core\] "Reaction@.*" threw an exception/);

  const c = fobx.computed(() => {
    ar.sort();
  });
  msg = grabConsole(() => {
    fobx.autorun(() => {
      c.value;
    })();
  });
  expect(ar).toStrictEqual([3, 2, 1]);
  expect(msg).toMatch(/<STDERR> \[@fobx\/core\] "Computed@.*" threw an exception/);
});

test("array should support iterall / iterable ", () => {
  const a = fobx.observable([1, 2, 3]);

  expect(iterall.isIterable(a)).toBe(true);

  const values: number[] = [];
  iterall.forEach(a, (v) => values.push(v));

  expect(values).toEqual([1, 2, 3]);

  let iter = iterall.getIterator(a);
  expect(iter.next()).toEqual({ value: 1, done: false });
  expect(iter.next()).toEqual({ value: 2, done: false });
  expect(iter.next()).toEqual({ value: 3, done: false });
  expect(iter.next()).toEqual({ value: undefined, done: true });

  a.replace([]);
  iter = iterall.getIterator(a);
  expect(iter.next()).toEqual({ value: undefined, done: true });
});

test("find(findIndex) and remove", function () {
  const a = fobx.observable([10, 20, 20]);
  function predicate(item) {
    return item === 20;
  }
  expect(a.find(predicate)).toBe(20);
  expect(a.findIndex(predicate)).toBe(1);
  expect(a.remove(20)).toBe(1);

  expect(a.find(predicate)).toBe(20);
  expect(a.findIndex(predicate)).toBe(1);
  expect(a.remove(20)).toBe(1);

  expect(a.find(predicate)).toBe(undefined);
  expect(a.findIndex(predicate)).toBe(-1);
  expect(a.remove(20)).toBe(-1);
});

test("concat should automatically slice observable arrays", () => {
  const a1 = fobx.observable([1, 2]);
  const a2 = fobx.observable([3, 4]);
  expect(a1.concat(a2)).toEqual([1, 2, 3, 4]);
});

test("observe", function () {
  const a = fobx.observable([1, 4]);
  const changes: number[][] = [];

  const d = fobx.reaction(
    () => a,
    (curr) => {
      changes.push([...curr]);
    }
  );

  a[1] = 3; // 1,3
  a[2] = 0; // 1, 3, 0
  a.shift(); // 3, 0
  a.push(1, 2); // 3, 0, 1, 2
  a.splice(1, 2, 3, 4); // 3, 3, 4, 2
  expect(a.slice()).toEqual([3, 3, 4, 2]);
  a.splice(6);
  a.splice(6, 2);
  // @ts-expect-error - on purpose
  a.replace(["a"]);
  a.pop();
  a.pop(); // does not fire anything

  const result = [[1, 3], [1, 3, 0], [3, 0], [3, 0, 1, 2], [3, 3, 4, 2], ["a"], []];
  expect(changes).toEqual(result);

  d();
  a[0] = 5;
  expect(changes).toEqual(result);
});

test("array modification1", function () {
  const a = fobx.observable([1, 2, 3]);
  const r = a.splice(-10, 5, 4, 5, 6);
  expect(a.slice()).toEqual([4, 5, 6]);
  expect(r).toEqual([1, 2, 3]);
});

test("serialize", function () {
  let a = [1, 2, 3];
  const m = fobx.observable(a);

  expect(JSON.stringify(m)).toEqual(JSON.stringify(a));

  expect(a).toEqual(m.slice());

  a = [4];
  m.replace(a);
  expect(JSON.stringify(m)).toEqual(JSON.stringify(a));
  expect(a).toEqual(m.toJSON());
});

test("array modification functions", function () {
  const ars = [[], [1, 2, 3]];
  const funcs = ["push", "pop", "shift", "unshift"];
  funcs.forEach(function (f) {
    ars.forEach(function (ar) {
      const a = ar.slice();
      const b = fobx.observable(a);
      const res1 = a[f](4);
      const res2 = b[f](4);
      expect(res1).toEqual(res2);
      expect(a).toEqual(b.slice());
    });
  });
});

test("array modifications", function () {
  const a2 = fobx.observable<number | undefined>([]);
  const inputs = [undefined, -10, -4, -3, -1, 0, 1, 3, 4, 10];
  const arrays: (number | undefined)[][] = [
    [],
    [1],
    [1, 2, 3, 4],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, undefined],
    [undefined],
  ];
  for (let i = 0; i < inputs.length; i++)
    for (let j = 0; j < inputs.length; j++)
      for (let k = 0; k < arrays.length; k++)
        for (let l = 0; l < arrays.length; l++) {
          [
            "array mod: [",
            arrays[k].toString(),
            "] i: ",
            inputs[i],
            " d: ",
            inputs[j],
            " [",
            arrays[l].toString(),
            "]",
          ].join(" ");
          const a1 = arrays[k].slice();
          a2.replace(a1);
          // eslint-disable-next-line prefer-spread
          const res1 = a1.splice.apply(a1, [inputs[i], inputs[j]].concat(arrays[l]));
          // eslint-disable-next-line prefer-spread
          const res2 = a2.splice.apply(a2, [inputs[i], inputs[j]].concat(arrays[l]));
          expect(a1.slice()).toEqual(a2.slice());
          expect(res1).toEqual(res2);
          expect(a1.length).toBe(a2.length);
        }
});

test("is array", function () {
  const x = fobx.observable([]);
  expect(x instanceof Array).toBe(true);

  // would be cool if this would return true...
  expect(Array.isArray(x)).toBe(true);
});

test("stringifies same as ecma array", function () {
  const x = fobx.observable<number>([]);
  expect(x instanceof Array).toBe(true);

  // would be cool if these two would return true...
  expect(x.toString()).toBe("");
  expect(x.toLocaleString()).toBe("");
  x.push(1, 2);
  expect(x.toString()).toBe("1,2");
  expect(x.toLocaleString()).toBe("1,2");
});

test("observes when stringified", function () {
  const x = fobx.observable<number>([]);
  let c = 0;
  fobx.autorun(function () {
    x.toString();
    c++;
  });
  x.push(1);
  expect(c).toBe(2);
});

test("observes when stringified to locale", function () {
  const x = fobx.observable<number>([]);
  let c = 0;
  fobx.autorun(function () {
    x.toLocaleString();
    c++;
  });
  x.push(1);
  expect(c).toBe(2);
});

test("react to sort changes", function () {
  const x = fobx.observable([4, 2, 3]);
  const sortedX = fobx.computed(function () {
    return x.slice().sort();
  });
  let sorted;

  fobx.autorun(function () {
    sorted = sortedX.value;
  });

  expect(x.slice()).toEqual([4, 2, 3]);
  expect(sorted).toEqual([2, 3, 4]);
  x.push(1);
  expect(x.slice()).toEqual([4, 2, 3, 1]);
  expect(sorted).toEqual([1, 2, 3, 4]);
  x.shift();
  expect(x.slice()).toEqual([2, 3, 1]);
  expect(sorted).toEqual([1, 2, 3]);
});

test("autoextend buffer length", function () {
  const ar = fobx.observable(new Array(1000));
  let changesCount = -1;
  fobx.autorun(() => {
    ar.length;
    ++changesCount;
  });

  ar[ar.length] = 0;
  ar.push(0);

  expect(changesCount).toBe(2);
});

test("array exposes correct keys", () => {
  const keys: string[] = [];
  const ar = fobx.observable([1, 2]);
  for (const key in ar) keys.push(key);

  expect(keys).toEqual(["0", "1"]);
});

test("replace can handle large arrays", () => {
  const a = fobx.observable([]);
  const b = [];
  b.length = 1000 * 1000;
  expect(() => {
    a.replace(b);
  }).not.toThrow();

  expect(a.length).toBe(1000000);
});

test("can iterate arrays", () => {
  const x = fobx.observable<string>([]);
  const y: string[][] = [];
  const d = fobx.reaction(
    () => Array.from(x),
    (items) => y.push(items),
    { fireImmediately: true }
  );

  x.push("a");
  x.push("b");
  expect(y).toEqual([[], ["a"], ["a", "b"]]);
  d();
});

test("array is concat spreadable", () => {
  const x = fobx.observable([1, 2, 3, 4]);
  const y = [5].concat(x);
  expect(y.length).toBe(5);
  expect(y).toEqual([5, 1, 2, 3, 4]);
});

test("array is spreadable", () => {
  const x = fobx.observable([1, 2, 3, 4]);
  expect([5, ...x]).toEqual([5, 1, 2, 3, 4]);

  const y = fobx.observable([]);
  expect([5, ...y]).toEqual([5]);
});

test("array supports toStringTag", () => {
  // N.B. on old environments this requires polyfills for these symbols *and* Object.prototype.toString.
  // core-js provides both
  const a = fobx.observable([]);
  expect(Object.prototype.toString.call(a)).toBe("[object Array]");
});

test("slice works", () => {
  const a = fobx.observable([1, 2, 3]);
  expect(a.slice(0, 2)).toEqual([1, 2]);
});

test("slice is reactive", () => {
  const a = fobx.observable([1, 2, 3]);
  let ok = false;
  fobx.when(
    () => a.slice().length === 4,
    () => (ok = true)
  );
  expect(ok).toBe(false);
  a.push(1);
  expect(ok).toBe(true);
});

test("toString", () => {
  expect(fobx.observable([1, 2]).toString()).toEqual([1, 2].toString());
  expect(fobx.observable([1, 2]).toLocaleString()).toEqual([1, 2].toLocaleString());
});

test("can define properties on arrays", () => {
  const ar = fobx.observable([1, 2]);
  Object.defineProperty(ar, "toString", {
    enumerable: false,
    configurable: true,
    value: function () {
      return "hoi";
    },
  });

  expect(ar.toString()).toBe("hoi");
  expect("" + ar).toBe("hoi");
});

test("concats correctly", () => {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const x = fobx.observable({ data: [] as {}[] });

  function generate(count) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    const d: {}[] = [];
    for (let i = 0; i < count; i++) d.push({});
    return d;
  }

  x.data = generate(10000);
  const first = x.data[0];
  expect(Array.isArray(x.data)).toBe(true);

  x.data = x.data.concat(generate(1000));
  expect(Array.isArray(x.data)).toBe(true);
  expect(x.data[0]).toBe(first);
  expect(x.data.length).toBe(11000);
});

// TODO: what exactly is dehancer doing, do I need?
// test("dehances last value on shift/pop", () => {
//   const x1 = observable([3, 5])
//   _getAdministration(x1).dehancer = value => {
//       return value * 2
//   }
//   expect(x1.shift()).toBe(6)
//   expect(x1.shift()).toBe(10)

//   const x2 = observable([3, 5])
//   _getAdministration(x2).dehancer = value => {
//       return value * 2
//   }
//   expect(x2.pop()).toBe(10)
//   expect(x2.pop()).toBe(6)
// })

test("symbol key on array", () => {
  const x = fobx.observable([1, 2]);
  const s = Symbol("test");
  x[s] = 3;
  expect(x[s]).toBe(3);

  let reacted = false;
  const d = fobx.reaction(
    () => x[s],
    () => {
      reacted = true;
    }
  );

  x[s] = 4;
  expect(x[s]).toBe(4);

  // although x[s] can be stored, it won't be reactive!
  expect(reacted).toBe(false);
  d();
});

test("non-symbol key on array", () => {
  const x = fobx.observable([1, 2]);
  const s = "test";
  x[s] = 3;
  expect(x[s]).toBe(3);

  let reacted = false;
  const d = fobx.reaction(
    () => x[s],
    () => {
      reacted = true;
    }
  );

  x[s] = 4;
  expect(x[s]).toBe(4);

  // although x[s] can be stored, it won't be reactive!
  expect(reacted).toBe(false);
  d();
});

describe("extended array prototype", () => {
  const extensionKey = "__extension";

  // A single setup/teardown for all tests because we're pretending to do a
  // singular global (dirty) change to the "environment".
  beforeAll(() => {
    Array.prototype[extensionKey] = () => {};
  });
  afterAll(() => {
    delete Array.prototype[extensionKey];
  });

  test("creating an observable should work", () => {
    fobx.observable({ b: "b" });
  });

  test("extending an observable should work", () => {
    const a = { b: "b" };
    fobx.extendObservable(a, {});
  });
});

test("reproduce", () => {
  expect.assertions(1);
  try {
    // @ts-expect-error - test
    Array.prototype.extension = function () {
      console.log("I'm the extension!", this.length);
    };

    class Test {
      data = null as null | { someStr: string };

      constructor() {
        fobx.observable(this, {
          data: "observable",
        });
      }
    }

    const test = new Test();

    fobx.autorun(() => {
      if (test.data) expect(test.data.someStr).toBe("123");
    });

    test.data = { someStr: "123" };
  } finally {
    // @ts-expect-error - test
    delete Array.prototype.extension;
  }
});

// TODO: MobX is potentially more correct here by passing back the proxied array, but that tanks my proxy implementation
test("correct array should be passed to callbacks (DIFF from MobX)", () => {
  const array = fobx.observable([1, 2, 3]);

  function callback() {
    // eslint-disable-next-line prefer-rest-params
    const lastArg = arguments[arguments.length - 1];
    expect(lastArg).toStrictEqual(array);
  }
  ["every", "filter", "find", "findIndex", "flatMap", "forEach", "map", "reduce", "reduceRight", "some"].forEach(
    (method) => {
      if (Array.prototype[method]) array[method](callback);
      else console.warn("SKIPPING: " + method);
    }
  );
});

test("very long arrays can be safely passed to nativeArray.concat", () => {
  const nativeArray = ["a", "b"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const longNativeArray: any[] = [...Array(10000).keys()]; // MAX_SPLICE_SIZE seems to be the threshold
  const longObservableArray = fobx.observable(longNativeArray);
  expect(longObservableArray.length).toBe(10000);
  expect(longObservableArray).toEqual(longNativeArray);
  expect(longObservableArray[9000]).toBe(longNativeArray[9000]);
  expect(longObservableArray[9999]).toBe(longNativeArray[9999]);
  expect(longObservableArray[10000]).toBe(longNativeArray[10000]);

  const expectedArray = nativeArray.concat(longNativeArray);
  const actualArray = nativeArray.concat(longObservableArray);

  expect(actualArray).toEqual(expectedArray);

  const anotherArray = [0, 1, 2, 3, 4, 5];
  const observableArray = fobx.observable(anotherArray);
  const r1 = anotherArray.splice(2, 2, ...longNativeArray);
  const r2 = observableArray.splice(2, 2, ...longNativeArray);
  expect(r2).toEqual(r1);
  expect(observableArray).toEqual(anotherArray);
});

// TODO: another dehance (feels like I don't need since I do not wrap each item in array)
// describe("dehances", () => {
//   function supressConsoleWarn(fn) {
//       const { warn } = console
//       console.warn = () => {}
//       const result = fn()
//       console.warn = warn
//       return result
//   }

//   const dehancer = thing => {
//       // Dehance only objects of a proper type
//       if (thing && typeof thing === "object" && thing.hasOwnProperty("value")) {
//           return thing.value
//       }
//       // Support nested arrays
//       if (Array.isArray(thing)) {
//           // If array has own dehancer it's still applied prior to ours.
//           // It doesn't matter how many dehancers we apply,
//           // if they ignore unknown types.
//           return thing.map(dehancer)
//       }
//       // Ignore unknown types
//       return thing
//   }

//   let enhanced, dehanced, array

//   beforeEach(() => {
//       enhanced = [{ value: 1 }, { value: 2 }, { value: 3 }]
//       dehanced = enhanced.map(dehancer)
//       array = observable(enhanced)
//       mobx._getAdministration(array).dehancer = dehancer
//   })

//   test("slice", () => {
//       expect(array.slice()).toEqual(dehanced.slice())
//   })

//   test("filter", () => {
//       const predicate = value => value === 2
//       expect(array.filter(predicate)).toEqual(dehanced.filter(predicate))
//   })

//   test("concat", () => {
//       expect(array.concat(4)).toEqual(dehanced.concat(4))
//   })

//   test("entries", () => {
//       expect([...array.entries()]).toEqual([...dehanced.entries()])
//   })

//   test("every", () => {
//       array.every((value, index) => {
//           expect(value).toEqual(dehanced[index])
//           return true
//       })
//   })

//   test("find", () => {
//       const predicate = value => value === 2
//       expect(array.find(predicate)).toEqual(dehanced.find(predicate))
//   })

//   test("forEach", () => {
//       array.forEach((value, index) => {
//           expect(value).toEqual(dehanced[index])
//       })
//   })

//   test("includes", () => {
//       expect(array.includes(2)).toEqual(dehanced.includes(2))
//   })

//   test("indexOf", () => {
//       expect(array.indexOf(2)).toEqual(dehanced.indexOf(2))
//   })

//   test("join", () => {
//       expect(array.join()).toEqual(dehanced.join())
//   })

//   test("lastIndexOf", () => {
//       expect(array.lastIndexOf(2)).toEqual(dehanced.lastIndexOf(2))
//   })

//   test("map", () => {
//       array.map((value, index) => {
//           expect(value).toEqual(dehanced[index])
//           return value
//       })
//   })

//   test("pop", () => {
//       expect(array.pop()).toEqual(dehanced.pop())
//   })

//   test("reduce", () => {
//       array.reduce((_, value, index) => {
//           expect(value).toEqual(dehanced[index])
//       })
//   })

//   test("reduceRight", () => {
//       array.reduceRight((_, value, index) => {
//           expect(value).toEqual(dehanced[index])
//       })
//   })

//   test("reverse", () => {
//       const reversedArray = supressConsoleWarn(() => array.reverse())
//       expect(reversedArray).toEqual(dehanced.reverse())
//   })

//   test("shift", () => {
//       expect(array.shift()).toEqual(dehanced.shift())
//   })

//   test("some", () => {
//       array.some((value, index) => {
//           expect(value).toEqual(dehanced[index])
//           return false
//       })
//   })

//   test("splice", () => {
//       expect(array.splice(1, 2)).toEqual(dehanced.splice(1, 2))
//   })

//   test("sort", () => {
//       const comparator = (a, b) => {
//           expect(typeof a).toEqual("number")
//           expect(typeof b).toEqual("number")
//           return b > a
//       }
//       const sortedArray = supressConsoleWarn(() => array.sort(comparator))
//       expect(sortedArray).toEqual(dehanced.sort(comparator))
//   })

//   test("values", () => {
//       expect([...array.values()]).toEqual([...dehanced.values()])
//   })

//   test("flat/flatMap", () => {
//       const nestedArray = [{ value: 1 }, [{ value: 2 }, [{ value: 3 }]]]
//       const dehancedNestedArray = nestedArray.map(dehancer)

//       // flat
//       array.replace(nestedArray)
//       expect(array.flat(Infinity)).toEqual(dehancedNestedArray.flat(Infinity))

//       // flatMap
//       const flattenedArray = array.flatMap((value, index) => {
//           expect(value).toEqual(dehancedNestedArray[index])
//           return value
//       })
//       expect(flattenedArray).toEqual(dehancedNestedArray.flat(1))
//   })
// })

test("reduce without initial value", () => {
  const array = [1, 2, 3];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observableArray = fobx.observable<any>(array);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayReducerArgs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observableArrayReducerArgs: any[] = [];

  const arraySum = array.reduce((...args) => {
    arrayReducerArgs.push(args);
    return args[0] + args[1];
  });
  const observableArraySum = observableArray.reduce((...args) => {
    observableArrayReducerArgs.push(args);
    return args[0] + args[1];
  });

  expect(arraySum).toEqual(1 + 2 + 3);
  expect(observableArraySum).toEqual(arraySum);
  expect(arrayReducerArgs).toEqual(observableArrayReducerArgs);
});

test("accessing out of bound indices is supported", () => {
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
    throw new Error(`Unexpected console.warn call`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const array = fobx.observable<any>([]);

  array[1];
  array[2];
  array[1001] = "foo";
  expect(array.length).toBe(1002);
  expect(array[1001]).toBe("foo");

  consoleWarnSpy.mockRestore();
});
