import type { IObservableCollectionAdmin } from "../observables/observable";
import type { IObservableAdmin } from "./observableBox";
import { trackObservable } from "../transactions/tracking";
import { getGlobalState } from "../state/global";

const globalState = /* @__PURE__ */ getGlobalState();

export const wrapIteratorForTracking = <T>(iterator: IterableIterator<T>, admin: IObservableAdmin) => {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(iterator), "next");
  if (desc && typeof desc.value === "function") {
    Object.defineProperty(iterator, "next", {
      value: () => {
        trackObservable(admin);
        // eslint-disable-next-line @typescript-eslint/ban-types
        return (desc.value as Function).call(iterator);
      },
    });
  }
  return iterator;
};

export const incrementChangeCount = (admin: IObservableCollectionAdmin) => {
  admin.previous = admin.current;
  admin.changes = globalState.getNextId();
  admin.current = `${admin.name}.${admin.changes}`;
};
