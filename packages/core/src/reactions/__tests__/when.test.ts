import { observable } from "../../observables/observable";
import { configure } from "../../state/instance";
import { when } from "../when";

beforeAll(() => {
  configure({ enforceActions: false });
});

test("when reaction dispose itself once condition is met", () => {
  const a = observable(0);
  let runs = 0;

  when(
    () => a.value === 1,
    () => {
      runs += 1;
    },
    { timeout: 100 }
  );

  a.value = 1;
  expect(runs).toBe(1);

  // the reaction was disposed so changing the value to 1 again doesn't cause another run
  a.value = 2;
  a.value = 1;
  expect(runs).toBe(1);
});

test("when reaction throws timeout error if timeout was hit", () => {
  jest.useFakeTimers();
  const a = observable(0);
  let runs = 0;

  when(
    () => a.value === 1,
    () => {
      runs += 1;
    },
    { timeout: 100 }
  );

  expect(() => jest.advanceTimersByTime(100)).toThrow("When reaction timed out");
  // reaction is disposed when timeout occurs
  a.value = 1;
  expect(runs).toBe(0);
  jest.useRealTimers();
});

test("when reaction calls onError function on timeout if one is provided", () => {
  jest.useFakeTimers();
  const a = observable(0);
  const onError = jest.fn();
  let runs = 0;

  when(
    () => a.value === 1,
    () => {
      runs += 1;
    },
    { timeout: 100, onError }
  );

  expect(() => jest.advanceTimersByTime(100)).not.toThrow();
  expect(onError).toHaveBeenCalledWith(Error("When reaction timed out"));

  // reaction is disposed when timeout occurs
  a.value = 1;
  expect(runs).toBe(0);
  jest.useRealTimers();
});

test("when reaction does nothing when timeout occurs after being disposed", () => {
  jest.useFakeTimers();

  const dispose = when(
    () => false,
    () => {},
    { timeout: 100 }
  );
  dispose();

  expect(() => jest.advanceTimersByTime(100)).not.toThrow();

  jest.useRealTimers();
});

test("an error is thrown if onError is provided as an option to async when", () => {
  expect(() => when(() => false, { onError: jest.fn() })).toThrow(
    "[@fobx/core] Cannot use onError option when using async when."
  );
});

test("async when rejects when timeout hits", async () => {
  const p = when(() => false, { timeout: 1 });
  expect.assertions(1);
  try {
    await p;
  } catch (e) {
    expect(e).toStrictEqual(Error("When reaction timed out"));
  }
});

test("async when rejects cancel is called", async () => {
  jest.useFakeTimers();
  const p = when(() => false, { timeout: 100 });
  expect.assertions(1);
  try {
    p.cancel();
    await p;
  } catch (e) {
    expect(e).toStrictEqual(Error("When reaction was canceled"));
  }
});

test("async when rejects when AbortSignal aborts", async () => {
  jest.useFakeTimers();
  const controller = new AbortController();

  const p = when(() => false, { timeout: 100, signal: controller.signal });
  expect.assertions(1);
  try {
    controller.abort();
    await p;
  } catch (e) {
    expect(e).toStrictEqual(Error("When reaction was aborted"));
  }
});
