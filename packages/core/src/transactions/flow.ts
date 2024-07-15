import { $fobx, type Any } from "../state/global";
import { isPromise } from "../utils/predicates";
import { runInAction } from "./action";

export type FlowOptions = {
  name?: string;
  getThis?: (that: unknown) => unknown;
};

export function flow<R>(makeGenerator: (...args: Any[]) => Generator<Any, Any, Any>, options?: FlowOptions) {
  const name =
    options?.name && options.name !== ""
      ? options.name
      : makeGenerator.name !== ""
        ? makeGenerator.name
        : "<unnamed flow>";

  const flow = function (this: unknown, ...args: Any[]): Promise<R> {
    const generator = makeGenerator.apply(options?.getThis ? options.getThis(this) : this, args);

    const next = async (value: Any, resolve: (v: Any) => void, reject: (reason?: Any) => void) => {
      try {
        const result = runInAction(() => generator.next(value));
        value = isPromise(result.value) ? await result.value : result.value;

        if (result.done) {
          resolve(value);
        } else {
          next(value, resolve, reject);
        }
      } catch (e) {
        try {
          const result = runInAction(() => generator.throw(e));
          resolve(result.value);
        } catch (ex) {
          return reject(ex);
        }
      }
    };

    const promise = new Promise<R>((resolve, reject) => {
      next(undefined, resolve, reject);
    });

    return promise;
  };

  Object.defineProperties(flow, {
    name: { value: name },
    [$fobx]: { value: "flow" },
  });
  Object.setPrototypeOf(flow, makeGenerator);
  return flow;
}
