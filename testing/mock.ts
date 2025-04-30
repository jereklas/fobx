// deno-lint-ignore-file no-explicit-any

export type MockCall = {
  args: any[]
  returned?: any
  thrown?: any
  timestamp: number
  returns: boolean
  throws: boolean
}

export const MOCK_SYMBOL = Symbol.for("@MOCK")

export type MockFn<R extends any> = ((...args: any[]) => R) & {
  mockClear: () => void
}

export function fn<R extends any>(
  ...stubs: ((...args: any[]) => R)[]
): MockFn<R> {
  const calls: MockCall[] = []

  const f = (...args: any[]) => {
    const stub = stubs.length === 1
      // keep reusing the first
      ? stubs[0]
      // pick the exact mock for the current call
      : stubs[calls.length]

    try {
      const returned = stub ? stub(...args) : undefined
      calls.push({
        args,
        returned,
        timestamp: Date.now(),
        returns: true,
        throws: false,
      })
      return returned
    } catch (err) {
      calls.push({
        args,
        timestamp: Date.now(),
        returns: false,
        thrown: err,
        throws: true,
      })
      throw err
    }
  }

  Object.defineProperty(f, MOCK_SYMBOL, {
    value: { calls },
    writable: false,
  })

  Object.defineProperty(f, "mockClear", { value: () => calls.length = 0 })

  return f as MockFn<R>
}
