import type { IObservableAdmin } from "./observableBox";
import type { Any } from "../state/global";

type StaleNotification = {
  type: "stale";
  name: string;
};

type ReadyNotification<T> = {
  type: "change" | "ready";
  name: string;
  oldValue: T;
  newValue: T;
  admin: IObservableAdmin<T>;
};

export type StateNotification<T = Any> = StaleNotification | ReadyNotification<T>;

export function sendStale(admin: IObservableAdmin) {
  admin.observers.forEach((o) => {
    o.onStateChange({ type: "stale", name: admin.name });
  });
}

export function sendReady<T>(admin: IObservableAdmin<T>, oldValue: unknown, newValue: unknown) {
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

export function sendChange<T>(admin: IObservableAdmin<T>, oldValue: unknown, newValue: unknown) {
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
