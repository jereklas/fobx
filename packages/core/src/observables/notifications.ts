import type { Any, IObservableValueAdmin } from "../types";

type StaleNotification = {
  type: "stale";
  name: string;
};

type ReadyNotification<T> = {
  type: "change" | "ready";
  name: string;
  oldValue: T;
  newValue: T;
  admin: IObservableValueAdmin<T>;
};

export type StateNotification<T = Any> =
  | StaleNotification
  | ReadyNotification<T>;

export function sendStale(admin: IObservableValueAdmin) {
  admin.observers.forEach((o) => {
    o.onStateChange({ type: "stale", name: admin.name });
  });
}

export function sendReady<T>(
  admin: IObservableValueAdmin<T>,
  oldValue: unknown,
  newValue: unknown,
) {
  admin.observers.forEach((o) => {
    o.onStateChange({
      type: "ready",
      name: admin.name,
      oldValue,
      newValue,
      admin: admin,
    });
  });
}

export function sendChange<T>(
  admin: IObservableValueAdmin<T>,
  oldValue: unknown,
  newValue: unknown,
) {
  admin.observers.forEach((o) => {
    o.onStateChange({
      type: "change",
      name: admin.name,
      oldValue,
      newValue,
      admin: admin,
    });
  });
}
