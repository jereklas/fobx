/* eslint-disable @typescript-eslint/no-explicit-any */
import Bench from "tinybench";

import { configure, observable as mobxObservable, reaction as mobxReaction } from "mobx";
import { observable, reaction } from "../src";

configure({ enforceActions: "never" });

type BaseTest = { name: string; getFn: (m: Map<any, any>) => () => any };

const runBench = async (size: number, tests: BaseTest[]) => {
  const n = new Map();
  const m = mobxObservable.map();
  const s = observable(new Map());

  const bench = new Bench({
    time: 100,
    setup: () => {
      for (let i = 0; i < size; i += 1) {
        n.set(i, i);
        s.set(i, i);
        m.set(i, i);
      }
    },
  });

  tests.forEach((t) => {
    bench.add(t.name, t.getFn(n)).add(`${t.name}-fobx`, t.getFn(s)).add(`${t.name}-mobx`, t.getFn(m));
  });

  await bench.run();
  const results: Record<string, Record<string, string | undefined>> = {};
  const table = bench.table();

  for (let i = 0; i < tests.length; i += 1) {
    results[tests[i].name] = {
      "js (ops/sec)": table[i * 3]?.["ops/sec"],
      "fobx (ops/sec)": table[i * 3 + 1]?.["ops/sec"],
      "mobx (ops/sec)": table[i * 3 + 2]?.["ops/sec"],
    };
  }
  return results;
};

const tests: BaseTest[] = [
  { name: "map.has(500)", getFn: (m) => () => m.has(500) },
  { name: "map.get(256)", getFn: (m) => () => m.has(256) },
  { name: "map.forEach(i => i*2)", getFn: (m) => () => m.forEach((i) => i * 2) },
  {
    name: "map.set(-1,-1); map.delete(-1)",
    getFn: (m) => () => {
      m.set(-1, -1);
      m.delete(-1);
    },
  },
  {
    name: "for(const e of m.entries())",
    getFn: (m) => () => {
      // eslint-disable-next-line no-empty-pattern
      for (const {} of m.entries()) {
        /* empty */
      }
    },
  },
  {
    name: "clear map and re-add 1k items",
    getFn: (m) => () => {
      m.clear();
      for (let i = 0; i < 1000; i += 1) {
        m.set(i, i);
      }
    },
  },
];

const runReactionBench = async (size: number) => {
  const reactionTests: BaseTest[] = [{ name: "map.forEach(i => i * 2)", getFn: (m) => () => m.forEach((i) => i * 2) }];

  const s = observable(new Map());
  const m = mobxObservable.map();
  const mr: ReturnType<typeof mobxReaction>[] = [];
  const sr: ReturnType<typeof reaction>[] = [];
  const bench = new Bench({
    time: 100,
    setup: () => {
      for (let i = 0; i < size; i += 1) {
        m.set(i, i);
        s.set(i, i);
      }
    },
  });

  const createFobxOptions = (t, reactionCount) => {
    return {
      beforeAll: () => {
        for (let i = 0; i < reactionCount; i += 1) {
          sr.push(
            reaction(t.getFn(s), () => {
              /*a*/
            })
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
            mobxReaction(t.getFn(m), () => {
              /*not empty*/
            })
          );
        }
      },
      afterAll: () => {
        mr.forEach((d) => d());
        mr.length = 0;
      },
    };
  };

  reactionTests.forEach((t) => {
    bench.add(`${t.name}-1-fobx`, () => s.set(1, 2), createFobxOptions(t, 1));
    bench.add(`${t.name}-1-mobx`, () => m.set(1, 2), createMobxOptions(t, 1));
    bench.add(`${t.name}-5-fobx`, () => s.set(1, 2), createFobxOptions(t, 5));
    bench.add(`${t.name}-5-mobx`, () => m.set(1, 2), createMobxOptions(t, 5));
    bench.add(`${t.name}-20-fobx`, () => s.set(1, 2), createFobxOptions(t, 20));
    bench.add(`${t.name}-20-mobx`, () => m.set(1, 2), createMobxOptions(t, 20));
  });

  await bench.run();

  const data = bench.table();
  const results = {};
  for (let i = 0; i < reactionTests.length; i += 1) {
    results[`${reactionTests[i].name}`] = {
      "fobx[1] (ops/sec)": data[i * 6]?.["ops/sec"],
      "mobx[1] (ops/sec)": data[i * 6 + 1]?.["ops/sec"],
      "fobx[5] (ops/sec)": data[i * 6 + 2]?.["ops/sec"],
      "mobx[5] (ops/sec)": data[i * 6 + 3]?.["ops/sec"],
      "fobx[20] (ops/sec)": data[i * 6 + 4]?.["ops/sec"],
      "mobx[20] (ops/sec)": data[i * 6 + 5]?.["ops/sec"],
    };
  }
  return results;
};

console.log("\nRunning benchmark tests for Maps...\n");
runBench(1000, tests)
  .then((r) => {
    console.log("Starting with 1,000 items");
    console.table(r);
    return runReactionBench(10);
  })
  .then((r) => {
    console.log("\n1,000 items no reactions");
    console.table(r);
  });
