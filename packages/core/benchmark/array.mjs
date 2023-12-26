import { Bench } from "tinybench";
import {
  configure as mobxConfigure,
  observable as mobxObservable,
  reaction as mobxReaction,
} from "mobx/dist/mobx.cjs.production.min.js";
import pkg from "../dist/fobx.prod.cjs.js";

const { observable, reaction } = pkg;

mobxConfigure({ enforceActions: "never" });

/** @type {number[]} */
const n = [];
/** @type {number[]} */
const m = mobxObservable.array();
/** @type {number[]} */
const s = observable([]);

// NOTE: dynamically accessing plain array for function calls seems to misrepresent its ops/sec so
// so we have 1 function per array
const tests = [
  { name: "arr[50]", n: () => n[50], s: () => s[50], m: () => m[50] },
  { name: "arr.at(50)", n: () => n.at(50), s: () => s.at(50), m: () => m.at(50) },
  { name: "arr.push(1)", n: () => n.push(1), s: () => s.push(1), m: () => m.push(1) },
  { name: "arr.concat(1)", n: () => n.concat(1), s: () => s.concat(1), m: () => m.concat(1) },
  { name: "arr.pop()", n: () => n.pop(), s: () => s.pop(), m: () => m.pop() },
  { name: "arr.shift()", n: () => n.shift(), s: () => s.shift(), m: () => m.shift() },
  { name: "arr.reverse()", n: () => n.reverse(), s: () => s.reverse(), m: () => m.reverse() },
  {
    name: "arr.toReversed()",
    n: () => n.toReversed(),
    s: () => s.toReversed(),
    m: () => m.toReversed(),
  },
  { name: "arr.flat()", n: () => n.flat(), s: () => s.flat(), m: () => m.flat() },
  { name: "arr.sort()", n: () => n.sort(), s: () => s.sort(), m: () => m.sort() },
  { name: "arr.toSorted()", n: () => n.toSorted(), s: () => s.toSorted(), m: () => m.toSorted() },
  {
    name: "arr.toLocaleString()",
    n: () => n.toLocaleString(),
    s: () => s.toLocaleString(),
    m: () => m.toLocaleString(),
  },
  { name: "arr.toString()", n: () => n.toString(), s: () => s.toString(), m: () => m.toString() },
  {
    name: "arr.map(i => i * 2)",
    n: () => n.map((i) => i * 2),
    s: () => s.map((i) => i * 2),
    m: () => m.map((i) => i * 2),
  },
  {
    name: "arr.forEach(i => i * 2)",
    n: () => n.forEach((i) => i * 2),
    s: () => s.forEach((i) => i * 2),
    m: () => m.forEach((i) => i * 2),
  },
  {
    name: "arr.filter(i => i % 3)",
    n: () => n.filter((i) => i % 3),
    s: () => s.filter((i) => i % 3),
    m: () => m.filter((i) => i % 3),
  },
  {
    name: "arr.find(i => i === 500)",
    n: () => n.find((i) => i === 500),
    s: () => s.find((i) => i === 500),
    m: () => m.find((i) => i === 500),
  },
  {
    name: "arr.reduce((a,b) => a + b,0)",
    n: () => n.reduce((a, b) => a + b, 0),
    s: () => s.reduce((a, b) => a + b, 0),
    m: () => m.reduce((a, b) => a + b, 0),
  },
  {
    name: "arr.slice(50,52)",
    n: () => n.slice(50, 52),
    s: () => s.slice(50, 52),
    m: () => m.slice(50, 52),
  },
  {
    name: "arr.join(',')",
    n: () => n.join(","),
    s: () => s.join(","),
    m: () => m.join(","),
  },
  {
    name: "arr.every(i => i < 256)",
    n: () => n.every((i) => i < 256),
    s: () => s.every((i) => i < 256),
    m: () => m.every((i) => i < 256),
  },
  {
    name: "arr.some(i => i > 256)",
    n: () => n.some((i) => i > 256),
    s: () => s.some((i) => i > 256),
    m: () => m.some((i) => i > 256),
  },
  {
    name: "arr.splice(50,10,1,20)",
    n: () => n.splice(50, 10, 1, 20),
    s: () => s.splice(50, 10, 1, 20),
    m: () => m.splice(50, 10, 1, 20),
  },
  {
    name: "arr.toSpliced(50,10,1,20)",
    n: () => n.toSpliced(50, 10, 1, 20),
    s: () => s.toSpliced(50, 10, 1, 20),
    m: () => m.toSpliced(50, 10, 1, 20),
  },
];
const bench = new Bench({
  time: 100,
  setup: () => {
    for (let i = 0; i < 1000; i += 1) {
      n.push(i);
      m.push(i);
      s.push(i);
    }
  },
  teardown: () => {
    n.length = 0;
    m.length = 0;
    s.length = 0;
  },
});

tests.forEach((t) => {
  bench.add(t.name, t.n).add(`${t.name}-fobx`, t.s).add(`${t.name}-mobx`, t.m);
});

const reactionTests = [
  { name: "at", fn: 10 },
  { name: "map", fn: (i) => i * 2 },
  { name: "forEach", fn: (i) => i % 3 },
  { name: "filter", fn: (i) => i % 3 },
  { name: "join", fn: "," },
];

const createReactionBench = (initialArraySize, tests, fobxChange, mobxChange) => {
  const mr = [];
  const sr = [];
  const b = new Bench({
    time: 100,
    setup: () => {
      m.length = 0;
      s.length = 0;
      for (let i = 0; i < initialArraySize; i += 1) {
        m.push(i);
        s.push(i);
      }
    },
  });

  const createFobxOptions = (t, reactionCount) => {
    return {
      beforeAll: () => {
        for (let i = 0; i < reactionCount; i += 1) {
          sr.push(
            reaction(
              () => s[t.name](t.fn),
              () => {
                /*not empty*/
              }
            )
          );
        }
      },
      afterAll: () => {
        sr.forEach((d) => d());
        sr.length = 0;
      },
    };
  };
  const createMobxOptions = (t, reactionCount) => {
    return {
      beforeAll: () => {
        for (let i = 0; i < reactionCount; i += 1) {
          mr.push(
            mobxReaction(
              () => m[t.name](t.fn),
              () => {
                /*not empty*/
              }
            )
          );
        }
      },
      afterAll: () => {
        mr.forEach((d) => d());
        mr.length = 0;
      },
    };
  };
  tests.forEach((t) => {
    b.add(`${t.name}-1-fobx`, fobxChange, createFobxOptions(t, 1));
    b.add(`${t.name}-1-mobx`, mobxChange, createMobxOptions(t, 1));
    b.add(`${t.name}-5-fobx`, fobxChange, createFobxOptions(t, 5));
    b.add(`${t.name}-5-mobx`, mobxChange, createMobxOptions(t, 5));
    b.add(`${t.name}-20-fobx`, fobxChange, createFobxOptions(t, 20));
    b.add(`${t.name}-20-mobx`, mobxChange, createMobxOptions(t, 20));
  });

  return b;
};

const getReactionResults = (bench, tests) => {
  const data = bench.table();
  const results = {};
  for (let i = 0; i < tests.length; i += 1) {
    results[`arr.${tests[i].name}(${tests[i].fn.toString()})`] = {
      "fobx[1] (ops/sec)": data[i * 6]["ops/sec"],
      "mobx[1] (ops/sec)": data[i * 6 + 1]["ops/sec"],
      "fobx[5] (ops/sec)": data[i * 6 + 2]["ops/sec"],
      "mobx[5] (ops/sec)": data[i * 6 + 3]["ops/sec"],
      "fobx[20] (ops/sec)": data[i * 6 + 4]["ops/sec"],
      "mobx[20] (ops/sec)": data[i * 6 + 5]["ops/sec"],
    };
  }
  return results;
};

const reactionBench = createReactionBench(
  10,
  reactionTests,
  () => s.splice(9, 1, 9),
  () => m.splice(9, 1, 9)
);

const reactionStatic100 = createReactionBench(
  100,
  reactionTests,
  () => s.splice(99, 1, 99),
  () => m.splice(99, 1, 99)
);

const reactionStatic1000 = createReactionBench(
  1000,
  reactionTests,
  () => s.splice(999, 1, 999),
  () => m.splice(999, 1, 999)
);

await bench.run();
await reactionBench.run();
await reactionStatic100.run();
await reactionStatic1000.run();

const table = bench.table();

const results = {};
for (let i = 0; i < tests.length; i += 1) {
  results[tests[i].name] = {
    "js (ops/sec)": table[i * 3]["ops/sec"],
    "fobx (ops/sec)": table[i * 3 + 1]["ops/sec"],
    "mobx (ops/sec)": table[i * 3 + 2]["ops/sec"],
  };
}

console.log("\nArray with 1000 elements and no reactions");
console.table(results);
console.log("\nArray with 10 elements and [n] reactions");
console.table(getReactionResults(reactionBench, reactionTests));
console.log("\nArray with 100 elements and [n] reactions");
console.table(getReactionResults(reactionStatic100, reactionTests));
console.log("\nArray with 1000 elements and [n] reactions");
console.table(getReactionResults(reactionStatic1000, reactionTests));
