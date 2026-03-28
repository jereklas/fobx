import { $fobx, type Any } from "../state/global.ts"
import { runInTransaction } from "../transactions/batch.ts"

export type FlowOptions = {
  name?: string
  /** Override `this` inside the generator. Used for bound flows. */
  getThis?: (that: unknown) => unknown
}

function isThenable(value: Any): value is PromiseLike<Any> {
  return value != null && typeof value === "object" &&
    typeof value.then === "function"
}

// deno-lint-ignore no-explicit-any
export function flow<R = any>(
  makeGenerator: (this: unknown, ...args: Any[]) => Generator<Any, Any, Any>,
  options?: FlowOptions,
): (this: unknown, ...args: Any[]) => Promise<R> {
  const name = options?.name && options.name !== ""
    ? options.name
    : makeGenerator.name !== ""
    ? makeGenerator.name
    : "<unnamed flow>"

  const flowFn = function (this: unknown, ...args: Any[]): Promise<R> {
    const generator = makeGenerator.apply(
      options?.getThis ? options.getThis(this) : this,
      args,
    )

    const next = async (
      value: Any,
      resolve: (v: Any) => void,
      reject: (reason?: Any) => void,
    ) => {
      try {
        const result = runInTransaction(() => generator.next(value))
        value = isThenable(result.value) ? await result.value : result.value

        if (result.done) {
          resolve(value)
        } else {
          next(value, resolve, reject)
        }
      } catch (e) {
        try {
          const result = runInTransaction(() => generator.throw(e))
          resolve(result.value)
        } catch (ex) {
          return reject(ex)
        }
      }
    }

    return new Promise<R>((resolve, reject) => {
      next(undefined, resolve, reject)
    })
  }

  Object.defineProperties(flowFn, {
    name: { value: name },
    [$fobx]: { value: "flow" },
  })
  return flowFn
}
