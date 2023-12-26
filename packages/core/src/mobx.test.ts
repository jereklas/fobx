import { Bench } from "tinybench";

import * as mobx from "../../../node_modules/mobx/dist/mobx.cjs.production.min";
import * as fobx from "../dist/fobx.prod.cjs.js";

// import * as mobx from "mobx";
// import * as t from ".";

mobx.configure({ enforceActions: "never" });
fobx.configure({ enforceActions: false });

test("distance formula", () => {
  const p1 = fobx.observable({ x: 0, y: 0 });
  const p2 = fobx.observable({ x: 5, y: 5 });
  const xDeltaSq = fobx.computed(() => Math.pow(p1.x - p2.x, 2));
  const yDeltaSq = fobx.computed(() => Math.pow(p1.y - p2.y, 2));
  const distance = fobx.computed(() => Math.sqrt(xDeltaSq.value + yDeltaSq.value));
  const dispose = fobx.reaction(
    () => distance.value,
    (newValue) => console.log(`new distance between p1 and p2 is ${newValue}.`)
  );

  const adjust = fobx.action((a: { x: number; y: number }, b: { x: number; y: number }) => {
    p1.x = a.x;
    p1.y = a.y;
    p2.x = b.x;
    p2.y = b.y;
  });

  adjust({ x: 2, y: 0 }, { x: 9, y: 5 });
  dispose();
});

test.only("observable object performance", async () => {
  const obj = {
    a: 1,
    get b() {
      return this.a;
    },
  };
  const m = mobx.observable(obj);
  const s = fobx.observable(obj);

  let bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
    })
    .add("mobx", () => {
      m.a += 1;
    });
  await bench.run();
  console.log("incrementing observable");
  console.table(bench.table());

  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
    })
    .add("mobx", () => {
      m.a += 1;
    });

  await bench.run();
  console.log("incrementing observable with non-active computed");
  console.table(bench.table());

  s.a = 0;
  m.a = 0;
  fobx.reaction(
    () => s.a,
    () => {
      // comment
    }
  );
  mobx.reaction(
    () => m.a,
    () => {
      // comment
    }
  );
  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
      s.b;
    })
    .add("mobx", () => {
      m.a += 1;
      m.b;
    });

  await bench.run();
  console.log("increment observable with reaction + non-active computed");
  console.table(bench.table());

  s.a = 0;
  m.a = 0;
  fobx.reaction(
    () => s.b,
    () => {
      // comment
    }
  );
  mobx.reaction(
    () => m.b,
    () => {
      // comment
    }
  );
  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
      s.b;
    })
    .add("mobx", () => {
      m.a += 1;
      m.b;
    });

  await bench.run();
  console.log("increment observable with reaction + active computed");
  console.table(bench.table());
});

test("observable class performance", async () => {
  class MobX {
    a = 1;
    constructor() {
      mobx.makeAutoObservable(this);
    }
    get b() {
      return this.a;
    }
  }
  class Fobx {
    a = 1;
    constructor() {
      fobx.observable(this);
    }
    get b() {
      return this.a;
    }
  }

  const m = new MobX();
  const s = new Fobx();

  let bench = new Bench();
  bench
    .add("fobx", () => {
      s.b;
    })
    .add("mobx", () => {
      m.b;
    });
  await bench.run();
  console.log("reading non-active computed");
  console.table(bench.table());

  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
    })
    .add("mobx", () => {
      m.a += 1;
    });

  await bench.run();
  console.log("incrementing observable with non-active computed");
  console.table(bench.table());

  s.a = 0;
  m.a = 0;
  fobx.reaction(
    () => s.a,
    () => {
      // comment
    }
  );
  mobx.reaction(
    () => m.a,
    () => {
      // comment
    }
  );
  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
    })

    .add("mobx", () => {
      m.a += 1;
    });

  await bench.run();
  console.log("increment observable with reaction + non-active computed");
  console.table(bench.table());

  s.a = 0;
  m.a = 0;
  fobx.reaction(
    () => s.b,
    () => {
      // comment
    }
  );
  mobx.reaction(
    () => m.b,
    () => {
      // comment
    }
  );
  bench = new Bench();
  bench
    .add("fobx", () => {
      s.a += 1;
    })
    .add("mobx", () => {
      m.a += 1;
    });

  await bench.run();
  console.log("increment observable with reaction + active computed");
  console.table(bench.table());
});
