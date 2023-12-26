export function suppressConsole(block) {
  const messages: string[] = [];
  const { warn, error } = console;
  Object.assign(console, {
    warn(e) {
      messages.push("<STDOUT> " + e);
    },
    error(e) {
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

export function grabConsole(block) {
  return suppressConsole(block).join("\n");
}

test("", () => {
  /* here so testing doesn't complain about no tests for this util file */
});
