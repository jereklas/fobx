export function suppressConsole(block: Function) {
  const messages: string[] = [];
  const { warn, error } = console;
  Object.assign(console, {
    warn(e: any) {
      messages.push("<STDOUT> " + e);
    },
    error(e: any) {
      messages.push("<STDERR> " + e);
    },
  });
  try {
    block();
  } finally {
    Object.assign(console, { warn, error });
  }
  return messages;
}

export function grabConsole(block: Function) {
  return suppressConsole(block).join("\n");
}
