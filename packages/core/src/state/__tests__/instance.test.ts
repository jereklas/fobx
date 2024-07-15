import { configure, isDifferent, instanceState } from "../instance";

describe("isDifferent", () => {
  test("throws error on structural compare if no structural compare has been configured", () => {
    expect(() => isDifferent("a", "a", "structural")).toThrow(
      "[@fobx/core] Need to supply a structural equality comparer in order to use struct comparisons. See 'configure' api for more details."
    );
  });

  test("structural compare is not called when using default diff", () => {
    const compare = jest.fn(() => true);
    configure({ comparer: { structural: compare } });

    expect(isDifferent("a", "a", "default")).toBe(false);
    expect(compare).not.toHaveBeenCalled();
  });
});

test("enforceActions is true by default, but can be set to false", () => {
  expect(instanceState.enforceActions).toBe(true);

  configure({ enforceActions: false });

  expect(instanceState.enforceActions).toBe(false);
});
