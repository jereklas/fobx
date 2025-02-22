/* eslint-disable @typescript-eslint/no-var-requires */
const {
  oneObserves10k,
  oneThousandObservingSibling,
  lateDepChange,
  incrementObs100k,
} = require("./testCases.cjs");
// import { oneObserves10k, oneThousandObservingSibling, lateDepChange, incrementObs100k } from "./testCases";

const results = {};

[
  // short observers list, large number of changes
  incrementObs100k,
  // long observers list, small number of changes
  lateDepChange,
  oneObserves10k,
  oneThousandObservingSibling,
].forEach((fn) => {
  const result = fn();
  results[result.name] = {
    "fobx (init/run)": result.fobx,
    "mobx (init/run)": result.mobx,
  };
});

console.table(results);
