import { configure, instanceState } from "../../src/state/instance";

test("enforceActions is true by default, but can be set to false", () => {
  expect(instanceState.enforceActions).toBe(true);

  configure({ enforceActions: false });

  expect(instanceState.enforceActions).toBe(false);
});
