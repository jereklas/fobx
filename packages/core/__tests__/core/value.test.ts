import type { ObservableValueWithAdmin, IReaction } from "../../src/types";

import { $fobx } from "../../src/state/global";
import * as fobx from "../../src";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

describe("ObservableValue", () => {
  test("wraps supplied value in an object", () => {
    const str = fobx.observable("a") as ObservableValueWithAdmin;
    expect(str[$fobx].observers.size).toBe(0);
    expect(str[$fobx].name).toBe("ObservableValue@1");
    expect(str.value).toBe("a");

    const num = fobx.observable(10) as ObservableValueWithAdmin;
    expect(num.value).toBe(10);
    expect(num[$fobx].name).toBe("ObservableValue@2");
    expect(num[$fobx].observers.size).toBe(0);
  });

  test("are correctly associated with the reaction when dereferenced.", () => {
    const obs1 = fobx.observable("a") as ObservableValueWithAdmin;
    const obs2 = fobx.observable("b") as ObservableValueWithAdmin;
    let r!: IReaction;
    const dispose = fobx.reaction(
      () => {
        return [obs1.value, obs2.value];
      },
      jest.fn((o, n, reaction) => {
        r = reaction as unknown as IReaction;
      })
    );
    // force reaction to run once so we can have reference to reaction
    obs1.value = "c";

    expect(r[$fobx].dependencies.length).toBe(2);
    expect(r[$fobx].dependencies.indexOf(obs1[$fobx])).not.toBe(-1);
    expect(r[$fobx].dependencies.indexOf(obs2[$fobx])).not.toBe(-1);

    expect(obs1[$fobx].observers.size).toBe(1);
    expect(obs2[$fobx].observers.size).toBe(1);
    expect(obs1[$fobx].observers.has(r[$fobx])).toBe(true);
    expect(obs2[$fobx].observers.has(r[$fobx])).toBe(true);
    dispose();
  });
});
