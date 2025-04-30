// deno-lint-ignore no-explicit-any
export function suppressConsole(block: (...args: any[]) => any) {
  const messages: string[] = []
  const { warn, error } = console
  Object.assign(console, {
    warn(e: unknown) {
      messages.push("<STDOUT> " + e)
    },
    error(e: unknown) {
      messages.push("<STDERR> " + e)
    },
  })
  try {
    block()
  } finally {
    Object.assign(console, { warn, error })
  }
  return messages
}

// deno-lint-ignore no-explicit-any
export function grabConsole(block: (...args: any[]) => any) {
  return suppressConsole(block).join("\n")
}
