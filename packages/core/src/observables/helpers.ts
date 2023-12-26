import type { IObservableValueAdmin, IObservableCollectionAdmin } from "../types";

import { trackObservable } from "../transactions/tracking";

export const wrapIteratorForTracking = <T>(iterator: IterableIterator<T>, admin: IObservableValueAdmin) => {
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
  admin.changes = admin.getNextChangeId();
  admin.current = `${admin.name}.${admin.changes}`;
};
