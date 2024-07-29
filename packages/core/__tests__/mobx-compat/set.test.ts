import * as fobx from "../../src";
import * as iterall from "iterall";
import { deepEqual } from "fast-equals";

test("set crud", function () {
  const s = fobx.observable(new Set<any>([1]));
  const changes: Set<any>[] = [];

  fobx.reaction(
    () => s,
    (val) => {
      expect(val).toBe(s);
      changes.push(new Set(val));
    }
  );

  expect(s.has(1)).toBe(true);
  expect(s.has("1")).toBe(false);
  expect(s.size).toBe(1);

  s.add("2");

  expect(s.has("2")).toBe(true);
  expect(s.size).toBe(2);
  expect(Array.from(s.keys())).toEqual([1, "2"]);
  expect(Array.from(s.values())).toEqual([1, "2"]);
  expect(Array.from(s.entries())).toEqual([
    [1, 1],
    ["2", "2"],
  ]);
  expect(Array.from(s)).toEqual([1, "2"]);
  expect(s.toJSON()).toEqual([1, "2"]);
  expect(s.toString()).toBe("[object ObservableSet]");

  s.replace(new Set([3]));

  expect(Array.from(s.keys())).toEqual([3]);
  expect(Array.from(s.values())).toEqual([3]);
  expect(s.size).toBe(1);
  expect(s.has(1)).toBe(false);
  expect(s.has("2")).toBe(false);
  expect(s.has(3)).toBe(true);

  s.replace(fobx.observable(new Set([4])));

  expect(Array.from(s.keys())).toEqual([4]);
  expect(Array.from(s.values())).toEqual([4]);
  expect(s.size).toBe(1);
  expect(s.has(1)).toBe(false);
  expect(s.has("2")).toBe(false);
  expect(s.has(3)).toBe(false);
  expect(s.has(4)).toBe(true);

  expect(() => {
    // @ts-expect-error - throwing on purpose
    s.replace("");
  }).toThrow("[@fobx/core] Supplied entries was not a Set or an Array.");

  s.clear();
  expect(Array.from(s.keys())).toEqual([]);
  expect(Array.from(s.values())).toEqual([]);
  expect(s.size).toBe(0);
  expect(s.has(1)).toBe(false);
  expect(s.has("2")).toBe(false);
  expect(s.has(3)).toBe(false);
  expect(s.has(4)).toBe(false);

  s.add(5);
  s.delete(5);

  expect(changes).toStrictEqual([new Set([1, "2"]), new Set([3]), new Set([4]), new Set(), new Set([5]), new Set()]);
});

test("observe value", function () {
  const s = fobx.observable(new Set());
  let hasX = false;
  let hasY = false;

  fobx.autorun(function () {
    hasX = s.has("x");
  });
  fobx.autorun(function () {
    hasY = s.has("y");
  });

  expect(hasX).toBe(false);

  s.add("x");
  expect(hasX).toBe(true);

  s.delete("x");
  expect(hasX).toBe(false);

  s.replace(["y"]);
  expect(hasX).toBe(false);
  expect(hasY).toBe(true);
  expect(Array.from(s.values())).toEqual(["y"]);
});

test("observe collections", function () {
  const x = fobx.observable(new Set());
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

  x.add("a");
  expect(keys).toEqual(["a"]);
  expect(values).toEqual(["a"]);
  expect(entries).toEqual([["a", "a"]]);

  x.forEach((value) => {
    expect(x.has(value)).toBe(true);
  });

  // should not retrigger:
  keys = null;
  values = null;
  entries = null;
  x.add("a");
  expect(keys).toEqual(null);
  expect(values).toEqual(null);
  expect(entries).toEqual(null);

  x.add("b");
  expect(keys).toEqual(["a", "b"]);
  expect(values).toEqual(["a", "b"]);
  expect(entries).toEqual([
    ["a", "a"],
    ["b", "b"],
  ]);

  x.delete("a");
  expect(keys).toEqual(["b"]);
  expect(values).toEqual(["b"]);
  expect(entries).toEqual([["b", "b"]]);
});

test("set modifier", () => {
  const x = fobx.observable(new Set([{ a: 1 }]));
  const y = fobx.observable({ a: x });

  expect(fobx.isObservableSet(x)).toBe(true);
  expect(fobx.isObservableObject(y)).toBe(true);
  expect(fobx.isObservableObject(y.a)).toBe(false);
  expect(fobx.isObservableSet(y.a)).toBe(true);
});

test("cleanup", function () {
  const s = fobx.observable(new Set(["a"]));

  let hasA;

  fobx.autorun(function () {
    hasA = s.has("a");
  });

  expect(hasA).toBe(true);
  expect(s.delete("a")).toBe(true);
  expect(s.delete("not-existing")).toBe(false);
  expect(hasA).toBe(false);
});

test("set should support iterall / iterable ", () => {
  const a = fobx.observable(new Set([1, 2]));

  function leech(iter) {
    const values: number[] = [];
    let v;
    do {
      v = iter.next();
      if (!v.done) values.push(v.value);
    } while (!v.done);
    return values;
  }

  expect(iterall.isIterable(a)).toBe(true);

  expect(leech(iterall.getIterator(a))).toEqual([1, 2]);

  expect(leech(a.entries())).toEqual([
    [1, 1],
    [2, 2],
  ]);

  expect(leech(a.keys())).toEqual([1, 2]);
  expect(leech(a.values())).toEqual([1, 2]);
});

test("support for ES6 Set", () => {
  const x = new Set();
  x.add(1);
  x.add(2);

  const s = fobx.observable(x);
  expect(fobx.isObservableSet(s)).toBe(true);
  expect(Array.from(s)).toEqual([1, 2]);
});

test("deepEqual set", () => {
  const x = new Set();
  x.add(1);
  x.add({ z: 1 });

  const x2 = fobx.observable(new Set());
  x2.add(1);
  x2.add({ z: 2 });

  expect(deepEqual(x, x2)).toBe(false);
  x2.replace([1, { z: 1 }]);
  expect(deepEqual(x, x2)).toBe(true);
});

test("set.clear should not be tracked", () => {
  const x = fobx.observable(new Set([1]));
  let c = 0;
  const d = fobx.autorun(() => {
    c++;
    x.clear();
  });

  expect(c).toBe(1);
  x.add(2);
  expect(c).toBe(1);

  d();
});

test("toStringTag", () => {
  const x = fobx.observable(new Set());
  expect(x[Symbol.toStringTag]).toBe("Set");
  expect(Object.prototype.toString.call(x)).toBe("[object Set]");
});

test("observe", () => {
  const changes: Set<number>[] = [];
  const x = fobx.observable(new Set([1]));
  fobx.reaction(
    () => x,
    (s) => {
      expect(s).toBe(x);
      changes.push(new Set(s));
    }
  );
  x.add(2);
  x.add(1);
  expect(changes).toStrictEqual([new Set([1, 2])]);
});

test("set.forEach is reactive", () => {
  let c = 0;
  const s = fobx.observable(new Set());

  fobx.autorun(() => {
    s.forEach(() => {});
    c++;
  });

  s.add(1);
  s.add(2);
  expect(c).toBe(3);
});
