/* eslint-disable @typescript-eslint/no-explicit-any */
import Bench from "tinybench";

import { configure, observable as mobxObservable } from "mobx";
import { observable } from "../src";

configure({ enforceActions: "never" });

type BaseTest = { name: string; getFn: (set: Set<any>) => () => any };

const runBench = async (size: number, tests: BaseTest[]) => {
  const n = new Set();
  const m = mobxObservable.set();
  const s = observable(new Set());

  const bench = new Bench({
    time: 100,
    setup: () => {
      for (let i = 0; i < size; i += 1) {
        n.add(i);
        s.add(i);
        m.add(i);
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
  { name: "set.has(500)", getFn: (set) => () => set.has(500) },
  { name: "set.get(256)", getFn: (set) => () => set.has(256) },
  { name: "set.forEach(i => i*2)", getFn: (set) => () => set.forEach((i) => i * 2) },
  {
    name: "set.add(-1); set.delete(-1)",
    getFn: (set) => () => {
      set.add(-1);
      set.delete(-1);
    },
  },
  {
    name: "for(const e of set.entries())",
    getFn: (set) => () => {
      // eslint-disable-next-line no-empty-pattern
      for (const {} of set.entries()) {
        /* empty */
      }
    },
  },
  {
    name: "clear set and re-add 1k items",
    getFn: (set) => () => {
      set.clear();
      for (let i = 0; i < 1000; i += 1) {
        set.add(i);
      }
    },
  },
];

console.log("\nRunning benchmark tests for Sets...\n");
runBench(1000, tests).then((r) => {
  console.log("Starting with 1,000 items");
  console.table(r);
});
