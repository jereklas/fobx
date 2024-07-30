import { reaction, ReactionWithAdmin } from "../../reactions/reaction";
import { $fobx } from "../../state/global";
import { configure } from "../../state/instance";
import { observableBox, ObservableBoxWithAdmin } from "../observableBox";

beforeEach(() => {
  configure({ enforceActions: false });
});

describe("ObservableBox", () => {
  test("wraps supplied value in an object", () => {
    const str = observableBox("a") as ObservableBoxWithAdmin;
    expect(str[$fobx].observers.size).toBe(0);
    expect(str[$fobx].name).toBe("ObservableBox@1");
    expect(str.value).toBe("a");

    const num = observableBox(10) as ObservableBoxWithAdmin;
    expect(num.value).toBe(10);
    expect(num[$fobx].name).toBe("ObservableBox@2");
    expect(num[$fobx].observers.size).toBe(0);
  });

  test("are correctly associated with the reaction when dereferenced.", () => {
    const obs1 = observableBox("a") as ObservableBoxWithAdmin;
    const obs2 = observableBox("b") as ObservableBoxWithAdmin;
    let r!: ReactionWithAdmin;
    const dispose = reaction(
      () => {
        return [obs1.value, obs2.value];
      },
      jest.fn((o, n, reaction) => {
        r = reaction as unknown as ReactionWithAdmin;
      })
    );
    // force reaction to run once so we can have reference to reaction
    obs1.value = "c";

    expect(r[$fobx].dependencies.length).toBe(2);
    // @ts-expect-error - test
    expect(r[$fobx].dependencies.indexOf(obs1[$fobx])).not.toBe(-1);
    // @ts-expect-error - test
    expect(r[$fobx].dependencies.indexOf(obs2[$fobx])).not.toBe(-1);

    expect(obs1[$fobx].observers.size).toBe(1);
    expect(obs2[$fobx].observers.size).toBe(1);
    expect(obs1[$fobx].observers.has(r[$fobx])).toBe(true);
    expect(obs2[$fobx].observers.has(r[$fobx])).toBe(true);
    dispose();
  });
});
