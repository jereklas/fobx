import type { Any } from "../state/global.ts"

interface ConversionContext {
  seen: WeakMap<object, Any>
}

let currentConversionContext: ConversionContext | null = null

export function withConversionContext<T>(
  fn: (context: ConversionContext) => T,
): T {
  if (currentConversionContext) {
    return fn(currentConversionContext)
  }

  const context: ConversionContext = {
    seen: new WeakMap(),
  }

  currentConversionContext = context
  try {
    return fn(context)
  } finally {
    currentConversionContext = null
  }
}

export function getConvertedValue<T>(source: object): T | undefined {
  return currentConversionContext?.seen.get(source) as T | undefined
}

export function rememberConvertedValue(
  source: object,
  observableValue: Any,
): void {
  currentConversionContext?.seen.set(source, observableValue)
}
