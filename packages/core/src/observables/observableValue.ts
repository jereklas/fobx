import type { Any, ComparisonType, EqualityChecker, IReactionAdmin, IFobxAdmin } from "../types";

import { runInAction } from "../transactions/action";
import { $fobx, getGlobalState } from "../state/global";
import { instanceState, isDifferent } from "../state/instance";
import { trackObservable } from "../transactions/tracking";
import { sendChange } from "./notifications";

const globalState = /* @__PURE__ */ getGlobalState();

export type ObservableValueWithAdmin<T = Any> = ObservableValue<T> & {
  [$fobx]: IObservableValueAdmin<T> & { options: ObservableValueOptions<T> };
};

export interface IObservableValue<T = Any> {
  value: T;
}

export interface IObservableValueAdmin<T = Any> extends IFobxAdmin {
  value: T;
  observers: Set<IReactionAdmin>;
  seen: boolean;
}
export type ObservableValueOptions<T> = {
  valueTransform?: (value: T) => Any;
  equals?: EqualityChecker;
  comparer?: ComparisonType;
};

export class ObservableValue<T = Any> implements IObservableValue<T> {
  constructor(val?: T, options?: ObservableValueOptions<T>) {
    Object.defineProperty(this, $fobx, {
      value: {
        name: `ObservableValue@${globalState.getNextId()}`,
        value: val as T,
        observers: new Set<IReactionAdmin>(),
        seen: false,
        options: options ?? {},
      },
    });
  }
  get value() {
    const admin = (this as unknown as ObservableValueWithAdmin)[$fobx];
    trackObservable(admin);
    return admin.value;
  }
  set value(newValue: T) {
    const admin = (this as unknown as ObservableValueWithAdmin)[$fobx];

    if (process.env.NODE_ENV !== "production") {
      if (instanceState.enforceActions) {
        if (globalState.batchedActionsCount === 0 && admin.observers.size > 0) {
          console.warn(
            `[@fobx/core] Changing tracked observable values (${admin.name}) outside of an action is forbidden.`
          );
        }
      }
    }

    runInAction(() => {
      const { options } = admin;
      const oldValue = admin.value;
      newValue = options.valueTransform ? options.valueTransform(newValue) : newValue;
      admin.value = newValue;

      if (isDifferent(oldValue, newValue, options.equals ?? options.comparer)) {
        sendChange(admin, oldValue, newValue);
      }
    });
  }
}

export function createObservableValue<T>(val?: T, options?: ObservableValueOptions<T>) {
  return new ObservableValue(val, options);
}
