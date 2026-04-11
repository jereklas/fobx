---
title: Performance
description: Performance comparison between FobX and MobX across core reactive operations, collections, and real-world workloads.
navTitle: Performance
navSection: ["@fobx/core"]
navOrder: 3.5
---

This page summarizes a [benchmark baseline](https://github.com/jereklas/fobx/blob/main/core/__tests__/bench/4-11-2026-baseline.json)
for `@fobx/core` versus MobX.

These numbers are a point-in-time measurement of the current implementations on
one machine, not a universal guarantee for every app. Still, they are a useful
snapshot of where FobX stands today: faster in every measured benchmark group,
with the largest gains in core reactivity overhead and mutation-heavy
collection paths.

---

## Headline results

- FobX was faster in all **64 of 64** benchmark groups.
- Overall geometric-mean speedup: **2.56x**.
- Overall median speedup: **2.37x**.
- Real-world suite geometric-mean speedup: **2.10x**.
- Smallest win: **1.06x** on `set-create-empty`.
- Largest win: **13.60x** on `action-simple`.

In other words: the slowest FobX win was effectively a tie, and the strongest
wins were not marginal - they were order-of-magnitude improvements in some of
the primitive reactivity paths.

---

## Suite breakdown

When comparing mixed workloads, geometric mean is the most useful rollup
because the benchmark set spans everything from sub-200 ns operations to
hundreds of microseconds.

| Suite | What it measures | Groups | Geometric mean | Median | Range |
| --- | --- | ---: | ---: | ---: | --- |
| `minimal_comparison.bench.ts` | Core observables, computeds, reactions, and dependency graph operations | 21 | 3.50x | 2.86x | 1.32x to 13.60x |
| `collections.bench.ts` | Arrays, maps, and sets across reads, writes, batching, and reactions | 26 | 2.26x | 2.11x | 1.06x to 7.19x |
| `realworld.bench.ts` | App-shaped workloads such as todo lists, tables, filtering, and graph updates | 17 | 2.10x | 2.04x | 1.21x to 3.96x |

The pattern is consistent across all three suites:

- Primitive reactive operations show the biggest absolute wins.
- Collection mutation paths are usually several times faster.
- Real-world scenarios still show material wins, even when the margins are more
  conservative than the smallest microbenchmarks.

---

## Representative benchmarks

Average time per iteration. Lower is better.

| Benchmark | MobX avg | FobX avg | Speedup |
| --- | ---: | ---: | ---: |
| `action-simple` | 1.38 us | 101.7 ns | 13.60x |
| `reaction-create` | 2.59 us | 247.5 ns | 10.47x |
| `rapid-box-100-writes` | 5.34 us | 595.0 ns | 8.98x |
| `computed-chained-3-levels` | 3.42 us | 474.5 ns | 7.21x |
| `array-pop` | 3.87 us | 538.0 ns | 7.19x |
| `autorun-create` | 1.14 us | 229.0 ns | 4.99x |
| `array-batch-write-100` | 49.12 us | 9.97 us | 4.93x |
| `action-batching-reactions` | 3.02 us | 628.0 ns | 4.82x |
| `map-computed-aggregation` | 40.37 us | 10.20 us | 3.96x |
| `array-reaction-filter-sort` | 26.43 us | 8.40 us | 3.14x |
| `dep-graph-wide-1-to-50` | 70.44 us | 26.46 us | 2.66x |
| `multiple-reactions-10` | 15.36 us | 6.05 us | 2.54x |
| `data-table-50-rows` | 574.98 us | 407.96 us | 1.41x |
| `todo-list-app` | 46.73 us | 38.59 us | 1.21x |

Three things stand out here:

- FobX is not just winning on synthetic hot loops. It is also faster on the
  larger app-shaped workloads in the real-world suite.
- The biggest gains cluster around bookkeeping-heavy operations — creating
  reactions, running transactions, propagating computed updates, and mutating
  observable collections.
- High-frequency writes scale especially well. Writing 100 observable boxes
  (`rapid-box-100-writes`) costs 8.98x less per iteration with FobX, and
  batching 100 reaction-triggering writes (`action-batching-reactions`) is
  4.82x cheaper. This is where reactive runtimes often regress under load.

---

## What the numbers suggest

At a high level, this benchmark set suggests that FobX's lower-level runtime
overhead is meaningfully smaller than MobX's in the current implementation.
That shows up in three practical ways:

1. **Cheaper reactive plumbing**

   Creating reactions, running actions, and traversing dependency graphs are
   all substantially faster. This matters because application-level performance
   is often limited by the cost of the reactive runtime itself, not just the
   user code inside reactions.

2. **Stronger collection mutation performance**

   Array, map, and set operations are consistently faster, especially writes
   and batched updates. If your state model leans heavily on reactive
   collections, this is one of the clearest advantages in the current numbers.

3. **Wins that survive contact with real workloads**

   The real-world suite is where exaggerated microbenchmark claims usually fall
   apart. That did not happen here. FobX still came out ahead in every one of
   those scenarios, with a 2.10x geometric-mean speedup across the suite.

---

## Benchmark methodology

- Runtime: `Deno 2.2.12 (x86_64-unknown-linux-gnu)`
- CPU: `11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz`
- Source suites:
  - `core/__tests__/bench/minimal_comparison.bench.ts`
  - `core/__tests__/bench/collections.bench.ts`
  - `core/__tests__/bench/realworld.bench.ts`
- Data source: [4-11-2026-baseline.json](https://github.com/jereklas/fobx/blob/main/core/__tests__/bench/4-11-2026-baseline.json)
  captured with `deno task bench --json`
- Aggregates on this page are computed from each benchmark's average iteration
  time using `mobx_avg / fobx_avg`

If you are evaluating FobX for production use, the right conclusion is not
"this exact multiplier will apply to my app." The right conclusion is that the
current runtime consistently beats MobX across microbenchmarks, collection
operations, and more realistic reactive workloads, which is exactly the pattern
you want to see before doing app-specific profiling.