import { isObservable, observable } from "../../src";

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

class NonObservableClass {}

test("isObservable correctly identifies observables", () => {
  const nonObservableValues = [
    0,
    "a",
    true,
    Symbol(),
    BigInt(Number.MAX_SAFE_INTEGER),
    [],
    new Set(),
    new Map(),
    new NonObservableClass(),
    {},
  ];

  nonObservableValues.forEach((i) => {
    expect(isObservable(i)).toBe(false);
  });

  // remove the object and class as they become a container of observable values but they
  // themselves are not observable
  nonObservableValues.pop();
  nonObservableValues.pop();

  nonObservableValues.forEach((i) => {
    const obs = observable(i);
    expect(isObservable(obs)).toBe(true);
  });

  expect(isObservable(observable({}))).toBe(false);
  expect(isObservable(new NonObservableClass())).toBe(false);
});
