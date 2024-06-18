import * as fobx from "../../src";
import * as iterall from "iterall";
import { deepEqual } from "fast-equals";
import { grabConsole } from "../utils";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

test.only("map crud", function () {
  const m = fobx.observable(new Map<fobx.Any, string>([[1, "a"]]));
  const changes: Map<fobx.Any, fobx.Any>[] = [];

  fobx.reaction(
    () => m,
    (val) => {
      changes.push(new Map(val));
    }
  );

  expect(m.has(1)).toBe(true);
  expect(m.has("1")).toBe(false);
  expect(m.get(1)).toBe("a");
  expect(m.get("b")).toBe(undefined);
  expect(m.size).toBe(1);

  m.set(1, "aa");
  m.set("1", "b");
  expect(m.has("1")).toBe(true);
  expect(m.get("1")).toBe("b");
  expect(m.get(1)).toBe("aa");

  const k = ["arr"];
  m.set(k, "arrVal");
  expect(m.has(k)).toBe(true);
  expect(m.get(k)).toBe("arrVal");

  const s = Symbol("test");
  expect(m.has(s)).toBe(false);
  expect(m.get(s)).toBe(undefined);
  m.set(s, "symbol-value");
  expect(m.get(s)).toBe("symbol-value");
  expect(m.get(s.toString())).toBe(undefined);

  expect(Array.from(m.keys())).toEqual([1, "1", k, s]);
  expect(Array.from(m.values())).toEqual(["aa", "b", "arrVal", "symbol-value"]);
  expect(Array.from(m)).toEqual([
    [1, "aa"],
    ["1", "b"],
    [k, "arrVal"],
    [s, "symbol-value"],
  ]);
  expect(new Map(m)).toEqual(
    new Map<fobx.Any, fobx.Any>([
      [1, "aa"],
      ["1", "b"],
      [k, "arrVal"],
      [s, "symbol-value"],
    ])
  );
  expect(JSON.stringify(m)).toBe(`[[1,"aa"],["1","b"],[["arr"],"arrVal"],[null,"symbol-value"]]`);
  expect(m.toString()).toBe("[object ObservableMap]");
  expect(m.size).toBe(4);

  m.clear();
  expect(Array.from(m.keys())).toEqual([]);
  expect(Array.from(m.values())).toEqual([]);
  expect(m.toJSON()).toEqual([]);
  expect(m.size).toBe(0);

  expect(m.has("a")).toBe(false);
  expect(m.has("b")).toBe(false);
  expect(m.get("a")).toBe(undefined);
  expect(m.get("b")).toBe(undefined);

  expect(changes).toStrictEqual([
    new Map([[1, "aa"]]),
    new Map<fobx.Any, fobx.Any>([
      [1, "aa"],
      ["1", "b"],
    ]),
    new Map<fobx.Any, fobx.Any>([
      [1, "aa"],
      ["1", "b"],
      [["arr"], "arrVal"],
    ]),
    new Map<fobx.Any, fobx.Any>([
      [1, "aa"],
      ["1", "b"],
      [k, "arrVal"],
      [s, "symbol-value"],
    ]),
    new Map(),
  ]);

  expect(JSON.stringify(m)).toBe("[]");
});

test("map merge", function () {
  const a = fobx.observable(
    new Map([
      ["a", 1],
      ["b", 2],
      ["c", 2],
    ])
  );
  const b = fobx.observable(
    new Map([
      ["c", 3],
      ["d", 4],
    ])
  );
  a.merge(b);
  expect(a.toJSON()).toEqual([
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["d", 4],
  ]);
});

test("observe value", function () {
  const a = fobx.observable(new Map());
  let hasX = false;
  let valueX = undefined;
  let valueY = undefined;

  fobx.autorun(function () {
    hasX = a.has("x");
  });

  fobx.autorun(function () {
    valueX = a.get("x");
  });

  fobx.autorun(function () {
    valueY = a.get("y");
  });

  expect(hasX).toBe(false);
  expect(valueX).toBe(undefined);

  a.set("x", 3);
  expect(hasX).toBe(true);
  expect(valueX).toBe(3);

  a.set("x", 4);
  expect(hasX).toBe(true);
  expect(valueX).toBe(4);

  a.delete("x");
  expect(hasX).toBe(false);
  expect(valueX).toBe(undefined);

  a.set("x", 5);
  expect(hasX).toBe(true);
  expect(valueX).toBe(5);

  expect(valueY).toBe(undefined);
  a.merge({ y: "hi" });
  expect(valueY).toBe("hi");
  a.merge({ y: "hello" });
  expect(valueY).toBe("hello");

  a.replace({ y: "stuff", z: "zoef" });
  expect(valueY).toBe("stuff");
  expect(Array.from(a.keys())).toEqual(["y", "z"]);
});

test("observe collections", function () {
  const x = fobx.observable(new Map());
  let keys, values, entries;

  fobx.autorun(function () {
    keys = Array.from(x.keys());
  });
  fobx.autorun(function () {
    values = Array.from(x.values());
  });
  fobx.autorun(function () {
    entries = Array.from(x.entries());
  });

  x.set("a", 1);
  expect(keys).toEqual(["a"]);
  expect(values).toEqual([1]);
  expect(entries).toEqual([["a", 1]]);

  // should not retrigger:
  keys = null;
  values = null;
  entries = null;
  x.set("a", 1);
  expect(keys).toEqual(null);
  expect(values).toEqual(null);
  expect(entries).toEqual(null);

  x.set("a", 2);
  expect(values).toEqual([2]);
  expect(entries).toEqual([["a", 2]]);

  x.set("b", 3);
  expect(keys).toEqual(["a", "b"]);
  expect(values).toEqual([2, 3]);
  expect(entries).toEqual([
    ["a", 2],
    ["b", 3],
  ]);

  x.has("c");
  expect(keys).toEqual(["a", "b"]);
  expect(values).toEqual([2, 3]);
  expect(entries).toEqual([
    ["a", 2],
    ["b", 3],
  ]);

  x.delete("a");
  expect(keys).toEqual(["b"]);
  expect(values).toEqual([3]);
  expect(entries).toEqual([["b", 3]]);
});

test("cleanup", function () {
  const x = fobx.observable(new Map([["a", 1]]));

  let aValue;
  const disposer = fobx.autorun(function () {
    aValue = x.get("a");
  });

  expect(aValue).toBe(1);
  expect(x.delete("a")).toBe(true);
  expect(x.delete("not-existing")).toBe(false);

  expect(aValue).toBe(undefined);

  x.set("a", 2);
  expect(aValue).toBe(2);

  disposer();
  expect(aValue).toBe(2);
});

test("strict", function () {
  const x = fobx.observable(new Map());
  fobx.autorun(function () {
    x.get("y"); // should not throw
  });
});

test("issue 100", function () {
  const that = {};
  fobx.extendObservable(that, {
    myMap: fobx.observable(new Map()),
  });
  // @ts-expect-error - extendObservable added it
  expect(fobx.isObservableMap(that.myMap)).toBe(true);
});

test("issue 119 - unobserve before delete", function () {
  const propValues: fobx.Any[] = [];
  const myObservable = fobx.observable({
    myMap: fobx.observable(new Map()),
  });
  myObservable.myMap.set("myId", {
    myProp: "myPropValue",
    get myCalculatedProp() {
      if (myObservable.myMap.has("myId")) return myObservable.myMap.get("myId").myProp + " calculated";
      return undefined;
    },
  });
  // the error only happens if the value is observed
  fobx.autorun(function () {
    Array.from(myObservable.myMap.values()).forEach(function (value) {
      propValues.push(value.myCalculatedProp);
    });
  });
  myObservable.myMap.delete("myId");

  expect(propValues).toEqual(["myPropValue calculated"]);
});

test("issue 116 - has should not throw on invalid keys", function () {
  const x = fobx.observable(new Map());
  expect(x.has(undefined)).toBe(false);
  expect(x.has({})).toBe(false);
  expect(x.get({})).toBe(undefined);
  expect(x.get(undefined)).toBe(undefined);
});

test("map modifier", () => {
  let x = fobx.observable(new Map<fobx.Any, fobx.Any>([["a", 1]]));
  expect(fobx.isObservableMap(x)).toBe(true);
  expect(x.get("a")).toBe(1);
  x.set("b", {});
  expect(fobx.isObservableObject(x.get("b"))).toBe(true);

  x = fobx.observable(new Map([["a", 1]]));
  expect(x.get("a")).toBe(1);

  x = fobx.observable(new Map());
  expect(Array.from(x.keys())).toEqual([]);

  const y = fobx.observable({ a: fobx.observable(new Map([["b", { c: 3 }]])) });
  expect(fobx.isObservableObject(y)).toBe(true);
  expect(fobx.isObservableObject(y.a)).toBe(false);
  expect(fobx.isObservableMap(y.a)).toBe(true);
  expect(fobx.isObservableObject(y.a.get("b"))).toBe(true);
});

test("map modifier with modifier", () => {
  let x = fobx.observable(new Map<fobx.Any, fobx.Any>([["a", { c: 3 }]]));
  expect(fobx.isObservableObject(x.get("a"))).toBe(true);
  x.set("b", { d: 4 });
  expect(fobx.isObservableObject(x.get("b"))).toBe(true);

  x = fobx.observable(new Map([["a", { c: 3 }]]), { deep: false });
  expect(fobx.isObservableObject(x.get("a"))).toBe(false);
  x.set("b", { d: 4 });
  expect(fobx.isObservableObject(x.get("b"))).toBe(false);

  const y = fobx.observable({ a: fobx.observable(new Map([["b", {}]]), { deep: false }) });
  expect(fobx.isObservableObject(y)).toBe(true);
  expect(fobx.isObservableMap(y.a)).toBe(true);
  expect(fobx.isObservableObject(y.a.get("b"))).toBe(false);
  y.a.set("e", {});
  expect(fobx.isObservableObject(y.a.get("e"))).toBe(false);
});

test("256, map.clear should not be tracked", () => {
  const x = fobx.observable(new Map([["a", 3]]));
  let c = 0;
  const d = fobx.autorun(() => {
    c++;
    x.clear();
  });

  expect(c).toBe(1);
  x.set("b", 3);
  expect(c).toBe(1);

  d();
});

test("256, map.merge should be not be tracked for target", () => {
  const x = fobx.observable(new Map([["a", 3]]));
  const y = fobx.observable(new Map([["b", 3]]));
  let c = 0;

  const d = fobx.autorun(() => {
    c++;
    x.merge(y);
  });

  expect(c).toBe(1);
  expect(Array.from(x.keys())).toEqual(["a", "b"]);

  y.set("c", 4);
  expect(c).toBe(2);
  expect(Array.from(x.keys())).toEqual(["a", "b", "c"]);

  x.set("d", 5);
  expect(c).toBe(2);
  expect(Array.from(x.keys())).toEqual(["a", "b", "c", "d"]);

  d();
});

test("308, map keys should be coerced to strings correctly", () => {
  const m = fobx.observable(new Map());
  m.set(1, true);
  m.delete(1);
  expect(Array.from(m.keys())).toEqual([]);

  m.set(1, true);
  m.set("1", false);
  m.set(0, true);
  m.set(-0, false);
  expect(Array.from(m.keys())).toEqual([1, "1", 0]);
  expect(m.get(-0)).toBe(false);
  expect(m.get(1)).toBe(true);

  m.delete("1");
  expect(Array.from(m.keys())).toEqual([1, 0]);

  m.delete(1);
  expect(Array.from(m.keys())).toEqual([0]);

  m.set(true, true);
  expect(m.get("true")).toBe(undefined);
  expect(m.get(true)).toBe(true);
  m.delete(true);
  expect(Array.from(m.keys())).toEqual([0]);
});

test("map should support iterall / iterable ", () => {
  const a = fobx.observable(
    new Map([
      ["a", 1],
      ["b", 2],
    ])
  );

  function leech(iter) {
    const values: fobx.Any[] = [];
    let v;
    do {
      v = iter.next();
      if (!v.done) values.push(v.value);
    } while (!v.done);
    return values;
  }

  expect(iterall.isIterable(a)).toBe(true);

  expect(leech(iterall.getIterator(a))).toEqual([
    ["a", 1],
    ["b", 2],
  ]);

  expect(leech(a.entries())).toEqual([
    ["a", 1],
    ["b", 2],
  ]);

  expect(leech(a.keys())).toEqual(["a", "b"]);
  expect(leech(a.values())).toEqual([1, 2]);
});

test("support for ES6 Map", () => {
  const x = new Map();
  x.set("x", 3);
  x.set("y", 2);

  const m = fobx.observable(x);
  expect(fobx.isObservableMap(m)).toBe(true);
  expect(Array.from(m)).toEqual([
    ["x", 3],
    ["y", 2],
  ]);

  const x2 = new Map();
  x2.set("y", 4);
  x2.set("z", 5);
  m.merge(x2);
  expect(m.get("z")).toEqual(5);

  const x3 = new Map();
  x3.set({ y: 2 }, { z: 4 });
});

test("deepEqual map", () => {
  const x = new Map();
  x.set("x", 3);
  x.set("y", { z: 2 });

  const x2 = fobx.observable(new Map());
  x2.set("x", 3);
  x2.set("y", { z: 3 });

  expect(deepEqual(x, x2)).toBe(false);
  x2.get("y").z = 2;
  expect(deepEqual(x, x2)).toBe(true);

  x2.set("z", 1);
  expect(deepEqual(x, x2)).toBe(false);
  x2.delete("z");
  expect(deepEqual(x, x2)).toBe(true);
  x2.delete("y");
  expect(deepEqual(x, x2)).toBe(false);
});

test("869, deeply observable map should make added items observables as well", () => {
  const store = {
    map_deep1: fobx.observable(new Map()),
    map_deep2: fobx.observable(new Map()),
  };

  expect(fobx.isObservable(store.map_deep1)).toBeTruthy();
  expect(fobx.isObservableMap(store.map_deep1)).toBeTruthy();
  expect(fobx.isObservable(store.map_deep2)).toBeTruthy();
  expect(fobx.isObservableMap(store.map_deep2)).toBeTruthy();

  store.map_deep2.set("a", []);
  expect(fobx.isObservable(store.map_deep2.get("a"))).toBeTruthy();

  store.map_deep1.set("a", []);
  expect(fobx.isObservable(store.map_deep1.get("a"))).toBeTruthy();
});

test("using deep map", () => {
  const store = {
    map_deep: fobx.observable(new Map()),
  };
  const seen: fobx.Any[] = [];

  // Creating autorun triggers one observation, hence -1
  let observed = -1;
  fobx.autorun(function () {
    // Use the map, to observe all changes
    seen.push(store.map_deep.toJSON());
    // JSON.stringify(store.map_deep)
    observed++;
  });
  expect(observed).toBe(0);

  store.map_deep.set("shoes", []);
  expect(observed).toBe(1);
  expect(seen).toEqual([[], [["shoes", []]]]);

  store.map_deep.get("shoes").push({ color: "black" });
  expect(seen).toEqual([
    [],
    // N.B. although the referred array changed, it didn't trigger a change in the map itself,
    // and is hence not observed by the autorun!
    [["shoes", [{ color: "black" }]]],
  ]);

  expect(observed).toBe(1);

  store.map_deep.get("shoes")[0].color = "red";
  // see above comment
  expect(seen).toEqual([[], [["shoes", [{ color: "red" }]]]]);
  expect(observed).toBe(1);
});

// TODO: implement toJS?
// test("using deep map - toJS", () => {
//   const store = {
//       map_deep: mobx.observable(new Map())
//   }
//   const seen = []

//   // Creating autorun triggers one observation, hence -1
//   let observed = -1
//   mobx.autorun(function () {
//       // Use the map, to observe all changes
//       seen.push(mobx.toJS(store.map_deep))
//       // JSON.stringify(store.map_deep)
//       observed++
//   })

//   store.map_deep.set("shoes", [])
//   expect(observed).toBe(1)
//   expect(seen).toEqual([new Map(), new Map([["shoes", []]])])

//   store.map_deep.get("shoes").push({ color: "black" })
//   expect(seen).toEqual([
//       new Map([]),
//       new Map([["shoes", []]]),
//       new Map([["shoes", [{ color: "black" }]]])
//   ])

//   expect(observed).toBe(2)
//   store.map_deep.get("shoes")[0].color = "red"
//   // see above comment
//   expect(seen).toEqual([
//       new Map([]),
//       new Map([["shoes", []]]),
//       new Map([["shoes", [{ color: "black" }]]]),
//       new Map([["shoes", [{ color: "red" }]]])
//   ])
//   expect(observed).toBe(3)
// })

test("issue 893", () => {
  const m = fobx.observable(new Map());
  const keys = ["constructor", "toString", "assertValidKey", "isValidKey", "toJSON", "toJS"];
  for (const key of keys) {
    expect(m.get(key)).toBe(undefined);
  }
});

test("work with 'toString' key", () => {
  const m = fobx.observable(new Map());
  expect(m.get("toString")).toBe(undefined);
  m.set("toString", "test");
  expect(m.get("toString")).toBe("test");
});

test("issue 940, should not be possible to change maps outside strict mode", () => {
  fobx.configure({ enforceActions: true });

  const m = fobx.observable(new Map());
  const d = fobx.autorun(() => Array.from(m.values()));

  expect(
    grabConsole(() => {
      m.set("x", 1);
    })
  ).toMatch(
    /<STDOUT> \[@fobx\/core\] Changing tracked observable value \(ObservableMap@.*\) outside of an action is forbidden\./
  );

  expect(
    grabConsole(() => {
      m.set("x", 2);
    })
  ).toMatch(
    /<STDOUT> \[@fobx\/core\] Changing tracked observable value \(ObservableMap@.*\) outside of an action is forbidden\./
  );

  expect(
    grabConsole(() => {
      m.delete("x");
    })
  ).toMatch(
    /<STDOUT> \[@fobx\/core\] Changing tracked observable value \(ObservableMap@.*\) outside of an action is forbidden\./
  );

  d();
});

test("issue 1243, .replace should not trigger change on unchanged values", () => {
  const m = fobx.observable(
    new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ])
  );

  let recomputeCount = 0;
  const computedValue = fobx.computed(() => {
    recomputeCount++;
    return m.get("a");
  });

  const d = fobx.autorun(() => {
    computedValue.value;
  });

  // recompute should happen once by now, due to the autorun
  expect(recomputeCount).toBe(1);

  // a hasn't changed, recompute should not happen
  m.replace({ a: 1, d: 5 });

  expect(recomputeCount).toBe(1);

  // this should cause a recompute
  m.replace({ a: 2 });
  expect(recomputeCount).toBe(2);

  // this should remove key a and cause a recompute
  m.replace({ b: 2 });
  expect(recomputeCount).toBe(3);

  m.replace([["a", 1]]);
  expect(recomputeCount).toBe(4);

  const nativeMap = new Map();
  nativeMap.set("a", 2);
  m.replace(nativeMap);
  expect(recomputeCount).toBe(5);

  expect(() => {
    // @ts-expect-error - on purpose
    m.replace("not-an-object");
  }).toThrow("[@fobx/core] Cannot convert to map from 'not-an-object'");

  d();
});

test("#1980 .replace should not breaks entities order!", () => {
  const original = fobx.observable(
    new Map([
      ["a", "first"],
      ["b", "second"],
    ])
  );
  const replacement = new Map([
    ["b", "first"],
    ["a", "second"],
  ]);
  original.replace(replacement);
  const newKeys = Array.from(replacement);
  const originalKeys = Array.from(replacement);
  for (let i = 0; i < newKeys.length; i++) {
    expect(newKeys[i]).toEqual(originalKeys[i]);
  }
});

test("#1980 .replace should invoke autorun", () => {
  const original = fobx.observable(
    new Map([
      ["a", "a"],
      ["b", "b"],
    ])
  );
  const replacement = { b: "b", a: "a" };
  let numOfInvokes = 0;
  fobx.autorun(() => {
    numOfInvokes++;
    return original.entries().next();
  });
  original.replace(replacement);
  const orgKeys = Array.from(original.keys());
  const newKeys = Object.keys(replacement);
  for (let i = 0; i < newKeys.length; i++) {
    expect(newKeys[i]).toEqual(orgKeys[i]);
  }
  expect(numOfInvokes).toBe(2);
});

test("#1980 .replace should not report changed unnecessarily", () => {
  const mapArray: [string, string][] = [
    ["swappedA", "swappedA"],
    ["swappedB", "swappedB"],
    ["removed", "removed"],
  ];
  const replacementArray: [string, string][] = [mapArray[1], mapArray[0], ["added", "added"]];
  const map = fobx.observable(new Map(mapArray));
  let autorunInvocationCount = 0;
  fobx.autorun(() => {
    map.get("swappedA");
    map.get("swappedB");
    autorunInvocationCount++;
  });
  map.replace(replacementArray);
  expect(Array.from(map.entries())).toEqual(replacementArray);
  expect(autorunInvocationCount).toBe(1);
});

test("#1258 cannot replace maps anymore", () => {
  const items = fobx.observable(new Map());
  items.replace(fobx.observable(new Map()));
});

test("can iterate maps", () => {
  const x = fobx.observable(new Map<string, string>());
  const y: [string, string][][] = [];
  const d = fobx.reaction(
    () => Array.from(x),
    (items) => y.push(items),
    { fireImmediately: true }
  );

  x.set("a", "A");
  x.set("b", "B");
  expect(y).toEqual([
    [],
    [["a", "A"]],
    [
      ["a", "A"],
      ["b", "B"],
    ],
  ]);
  d();
});

function iteratorToArray(it) {
  const res: fobx.Any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = it.next();
    if (!r.done) {
      res.push(r.value);
    } else {
      break;
    }
  }
  return res;
}

test("can iterate map - entries", () => {
  const x = fobx.observable(new Map());
  const y: [string, string][][] = [];
  const d = fobx.reaction(
    () => iteratorToArray(x.entries()),
    (items) => y.push(items),
    {
      fireImmediately: true,
    }
  );

  x.set("a", "A");
  x.set("b", "B");
  expect(y).toEqual([
    [],
    [["a", "A"]],
    [
      ["a", "A"],
      ["b", "B"],
    ],
  ]);
  d();
});

test("can iterate map - keys", () => {
  const x = fobx.observable(new Map());
  const y: string[][] = [];
  const d = fobx.reaction(
    () => iteratorToArray(x.keys()),
    (items) => y.push(items),
    {
      fireImmediately: true,
    }
  );

  x.set("a", "A");
  x.set("b", "B");
  expect(y).toEqual([[], ["a"], ["a", "b"]]);
  d();
});

test("can iterate map - values", () => {
  const x = fobx.observable(new Map());
  const y: string[][] = [];
  const d = fobx.reaction(
    () => iteratorToArray(x.values()),
    (items) => y.push(items),
    {
      fireImmediately: true,
    }
  );

  x.set("a", "A");
  x.set("b", "B");
  expect(y).toEqual([[], ["A"], ["A", "B"]]);
  d();
});

test("NaN as map key", function () {
  const a = fobx.observable(new Map([[NaN, 0]]));
  expect(a.has(NaN)).toBe(true);
  expect(a.get(NaN)).toBe(0);
  a.set(NaN, 1);
  a.merge(fobx.observable(new Map([[NaN, 2]])));
  expect(a.get(NaN)).toBe(2);
  expect(a.size).toBe(1);
});

test("maps.values, keys and maps.entries are iterables", () => {
  const x = fobx.observable(
    new Map([
      ["x", 1],
      ["y", 2],
    ])
  );
  expect(Array.from(x.entries())).toEqual([
    ["x", 1],
    ["y", 2],
  ]);
  expect(Array.from(x.values())).toEqual([1, 2]);
  expect(Array.from(x.keys())).toEqual(["x", "y"]);
});

test("toStringTag", () => {
  const x = fobx.observable(
    new Map([
      ["x", 1],
      ["y", 2],
    ])
  );
  expect(x[Symbol.toStringTag]).toBe("Map");
  expect(Object.prototype.toString.call(x)).toBe("[object Map]");
});

test("#1583 map.size not reactive", () => {
  const map = fobx.observable(new Map());
  const sizes: number[] = [];

  const d = fobx.autorun(() => {
    sizes.push(map.size);
  });

  map.set(1, 1);
  map.set(2, 2);
  d();
  map.set(3, 3);
  expect(sizes).toEqual([0, 1, 2]);
});

test("#1858 Map should not be inherited", () => {
  class MyMap extends Map {}

  const map = new MyMap();
  expect(() => {
    fobx.observable(map);
  }).toThrow("[@fobx/core] Cannot make observable map from class that inherit from Map: MyMap");
});

test("#2274", () => {
  const myMap = fobx.observable(new Map());
  myMap.set(1, 1);
  myMap.set(2, 1);
  myMap.set(3, 1);

  const newMap = fobx.observable(new Map());
  newMap.set(4, 1);
  newMap.set(5, 1);
  newMap.set(6, 1);

  myMap.replace(newMap);

  expect(Array.from(myMap.keys())).toEqual([4, 5, 6]);
  expect(myMap.has(2)).toBe(false);
});

test(".forEach() subscribes for key changes", () => {
  const map = fobx.observable(new Map());
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    map.forEach(() => {});
  });

  map.set(1, 1);
  map.set(2, 2);
  map.delete(1);

  expect(autorunInvocationCount).toBe(4);
});

test(".keys() subscribes for key changes", () => {
  const map = fobx.observable(new Map());
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.keys()) {
      // empty
    }
  });

  map.set(1, 1);
  map.set(2, 2);
  map.delete(1);

  expect(autorunInvocationCount).toBe(4);
});

test(".values() subscribes for key changes", () => {
  const map = fobx.observable(new Map());
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.values()) {
      // empty
    }
  });

  map.set(1, 1);
  map.set(2, 2);
  map.delete(1);

  expect(autorunInvocationCount).toBe(4);
});

test(".entries() subscribes for key changes", () => {
  const map = fobx.observable(new Map());
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.entries()) {
      // empty
    }
  });

  map.set(1, 1);
  map.set(2, 2);
  map.delete(1);

  expect(autorunInvocationCount).toBe(4);
});

test(".toJSON() subscribes for key changes", () => {
  const map = fobx.observable(new Map());
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    map.toJSON();
  });

  map.set(1, 1);
  map.set(2, 2);
  map.delete(1);

  expect(autorunInvocationCount).toBe(4);
});

test(".entries() subscribes for value changes", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.entries()) {
      // empty
    }
  });

  map.set(1, 11);
  map.set(2, 22);
  map.set(3, 33);

  expect(autorunInvocationCount).toBe(4);
});

test(".values() subscribes for value changes", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.values()) {
      // empty
    }
  });

  map.set(1, 11);
  map.set(2, 22);
  map.set(3, 33);

  expect(autorunInvocationCount).toBe(4);
});

test(".forEach() subscribes for value changes", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    map.forEach(() => {});
  });

  map.set(1, 11);
  map.set(2, 22);
  map.set(3, 33);

  expect(autorunInvocationCount).toBe(4);
});

test(".toJSON() subscribes for value changes", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    map.toJSON();
  });

  map.set(1, 11);
  map.set(2, 22);
  map.set(3, 33);

  expect(autorunInvocationCount).toBe(4);
});

test(".keys() does NOT subscribe for value changes", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of map.keys()) {
      // empty
    }
  });

  map.set(1, 11);
  map.set(2, 22);
  map.set(3, 33);

  expect(autorunInvocationCount).toBe(1);
});

test("noop mutations do NOT reportChanges", () => {
  const map = fobx.observable(
    new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  );
  let autorunInvocationCount = 0;

  fobx.autorun(() => {
    autorunInvocationCount++;
    map.forEach(() => {});
  });

  map.set(1, 1);
  map.set(2, 2);
  map.set(3, 3);
  // @ts-expect-error - on purpose
  map.delete("NOT IN MAP");
  map.merge([]);
  map.merge([
    [1, 1],
    [3, 3],
  ]);
  map.merge([
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  map.replace([
    [1, 1],
    [2, 2],
    [3, 3],
  ]);

  expect(autorunInvocationCount).toBe(1);
});

test("#2112 - iterators should be resilient to concurrent delete operation", () => {
  function testIterator(method) {
    const map = fobx.observable(
      new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ])
    );
    const expectedMap = fobx.observable(map);
    for (const entry of map[method]()) {
      const key = Array.isArray(entry) ? entry[0] : entry;
      const deleted1 = map.delete(key);
      const deleted2 = expectedMap.delete(key);
      expect(deleted1).toBe(true);
      expect(deleted2).toBe(true);
      expect(map.size).toBe(expectedMap.size);
      expect(Array.from(map)).toEqual(Array.from(expectedMap));
    }
  }

  testIterator("keys");
  testIterator("values");
  testIterator("entries");
});

test("2346 - subscribe to not yet existing map keys", async () => {
  const events = fobx.observable<number>([]);

  class Compute {
    values = fobx.observable(new Map());

    get get42() {
      return this.get(42);
    }

    constructor() {
      fobx.observable(this, { get: "none" });
    }

    get(k) {
      if (this.values.has(k)) return this.values.get(k);
      let v = k;
      this.values.set(k, k);
      setTimeout(
        () =>
          fobx.runInAction(() => {
            v *= 2;
            this.values.set(k, v);
          }),
        0
      );
      return this.values.get(k);
    }
  }

  const c = new Compute();

  fobx.autorun(() => events.push(c.get42));

  await fobx.when(() => events.length > 1);
  expect(events).toEqual([42, 84]);
});
