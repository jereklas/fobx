/* eslint-disable @typescript-eslint/no-var-requires */
const mobx = require("mobx/dist/mobx.cjs.production.min");
const fobx = require("../../dist/fobx.prod.cjs");
// import * as mobx from "mobx/dist/mobx.esm.production.min";
// import * as fobx from "../../dist/fobx.prod";

const failed = new Error("failed");

function oneObserves10k() {
  return {
    name: "10k chained computed values observing one observable",
    mobx: oneObserves10k_mobx(),
    fobx: oneObserves10k_fobx(),
  };
}
function oneObserves10k_mobx() {
  const a = mobx.observable.box(2);
  const observers = [];
  for (let i = 0; i < 10000; i += 1) {
    observers.push(mobx.computed(() => a.get() * i));
  }

  const b = mobx.computed(() => {
    let result = 0;
    for (let i = 0; i < observers.length; i += 1) {
      result += observers[i].get();
    }
    return result;
  });

  const start = Date.now();
  mobx.reaction(
    () => b.get(),
    () => {},
  );
  if (b.get() !== 99990000) throw failed;
  const initial = Date.now();

  a.set(3);
  if (b.get() !== 149985000) throw failed;
  const end = Date.now();

  return `${initial - start}/${end - initial} ms`;
}

function oneObserves10k_fobx() {
  const a = fobx.observableBox(2);
  const observers = [];
  for (let i = 0; i < 10000; i += 1) {
    observers.push(fobx.computed(() => a.value * i));
  }

  const b = fobx.computed(() => {
    let result = 0;
    for (let i = 0; i < observers.length; i += 1) {
      result += observers[i].value;
    }
    return result;
  });

  const start = Date.now();
  fobx.reaction(
    () => b.value,
    () => {},
  );
  if (b.value !== 99990000) throw failed;
  const initial = Date.now();

  a.value = 3;
  if (b.value !== 149985000) throw failed;
  const end = Date.now();

  return `${initial - start}/${end - initial} ms`;
}

function oneThousandObservingSibling() {
  return {
    name: "500 computed values observing their sibling",
    fobx: oneThousandObservingSibling_fobx(),
    mobx: oneThousandObservingSibling_mobx(),
  };
}
function oneThousandObservingSibling_mobx() {
  const observables = [mobx.observable.box(1)];
  for (let i = 0; i < 1000; i++) {
    observables.push(
      mobx.computed(function () {
        return observables[i].get() + 1;
      }),
    );
  }

  const start = Date.now();

  const last = observables[observables.length - 1];
  mobx.reaction(
    () => last.get(),
    () => {},
  );
  if (last.get() !== 1001) throw failed;
  const initial = Date.now();

  observables[0].set(2);
  if (last.get() !== 1002) throw failed;
  const end = Date.now();

  return `${initial - start}/${end - initial} ms`;
}
function oneThousandObservingSibling_fobx() {
  const observables = [fobx.observableBox(1)];
  for (let i = 0; i < 1000; i++) {
    observables.push(
      fobx.computed(function () {
        return observables[i].value + 1;
      }),
    );
  }

  const start = Date.now();

  const last = observables[observables.length - 1];
  fobx.reaction(
    () => last.value,
    () => {},
  );
  if (last.value !== 1001) throw failed;
  const initial = Date.now();

  observables[0].value = 2;
  if (last.value !== 1002) throw failed;
  const end = Date.now();

  return `${initial - start}/${end - initial} ms`;
}

function lateDepChange() {
  return {
    name: "late dependency change",
    fobx: lateDepChange_fobx(),
    mobx: lateDepChange_mobx(),
  };
}
function lateDepChange_mobx() {
  const values = [];
  for (let i = 0; i < 100; i++) values.push(mobx.observable.box(0));

  const sum = mobx.computed(function () {
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += values[i].get();
    return sum;
  });
  const start = Date.now();

  mobx.reaction(
    () => sum.get(),
    () => {},
  );

  for (let i = 0; i < 10000; i++) {
    values[99].set(i);
  }

  if (sum.get() !== 9999) throw failed;
  return `${Date.now() - start} ms`;
}
function lateDepChange_fobx() {
  const values = [];
  for (let i = 0; i < 100; i++) values.push(fobx.observableBox(0));

  const sum = fobx.computed(function () {
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += values[i].value;
    return sum;
  });
  const start = Date.now();

  fobx.reaction(
    () => sum.value,
    () => {},
  );

  for (let i = 0; i < 10000; i++) {
    values[99].value = i;
  }

  if (sum.value !== 9999) throw failed;
  return `${Date.now() - start} ms`;
}

function incrementObs100k() {
  return {
    name:
      "increment observable 100k times with 1 computed, 1 reaction, 1 autorun",
    fobx: incrementObs100k_fobx(),
    mobx: incrementObs100k_mobx(),
  };
}
function incrementObs100k_fobx() {
  const a = fobx.observableBox(0);
  const c = fobx.computed(() => a.value + 1);
  const d = fobx.reaction(
    () => c.value,
    () => {},
  );
  const d2 = fobx.autorun(() => a.value);
  const start = Date.now();
  for (let i = 0; i < 100_000; i += 1) {
    a.value += 1;
  }
  d();
  d2();
  return `${Date.now() - start} ms`;
}
function incrementObs100k_mobx() {
  const a = mobx.observable(0);
  const c = mobx.computed(() => a.get() + 1);
  const d = mobx.reaction(
    () => c.get(),
    () => {},
  );
  const d2 = mobx.autorun(() => a.get());
  const start = Date.now();
  for (let i = 0; i < 100_000; i += 1) {
    a.set(a.get() + 1);
  }
  d();
  d2();
  return `${Date.now() - start} ms`;
}

// export { oneObserves10k, oneThousandObservingSibling, lateDepChange, incrementObs100k };
module.exports = {
  oneObserves10k,
  oneThousandObservingSibling,
  lateDepChange,
  incrementObs100k,
};
