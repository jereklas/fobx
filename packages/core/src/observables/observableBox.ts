import { instanceState, isDifferent } from "../state/instance";
import type { IReactionAdmin } from "../reactions/reaction";
import { trackObservable } from "../transactions/tracking";
import { runInAction } from "../transactions/action";
import { sendChange } from "./notifications";
import {
  $fobx,
  type Any,
  type ComparisonType,
  type EqualityChecker,
  getGlobalState,
  type IFobxAdmin,
} from "../state/global";

const globalState = /* @__PURE__ */ getGlobalState();

export type ObservableBoxWithAdmin<T = Any> = ObservableBox<T> & {
  [$fobx]: IObservableAdmin<T> & { options: ObservableBoxOptions<T> };
};

export interface IObservable<T = Any> {
  value: T;
}

export interface IObservableAdmin<T = Any> extends IFobxAdmin {
  value: T;
  observers: IReactionAdmin[];
}
export type ObservableBoxOptions<T> = {
  valueTransform?: (value: T) => Any;
  equals?: EqualityChecker;
  comparer?: ComparisonType;
};

export class ObservableBox<T = Any> implements IObservable<T> {
  constructor(val?: T, options?: ObservableBoxOptions<T>) {
    Object.defineProperty(this, $fobx, {
      value: {
        name: `ObservableBox@${globalState.getNextId()}`,
        value: val as T,
        observers: [],
        options: options ?? {},
      },
    });
  }
  get value() {
    const admin = (this as unknown as ObservableBoxWithAdmin)[$fobx];
    trackObservable(admin);
    return admin.value;
  }
  set value(newValue: T) {
    const admin = (this as unknown as ObservableBoxWithAdmin)[$fobx];

    if (process.env.NODE_ENV !== "production") {
      if (instanceState.enforceActions) {
        if (
          globalState.batchedActionsCount === 0 && admin.observers.length > 0
        ) {
          console.warn(
            `[@fobx/core] Changing tracked observable values (${admin.name}) outside of an action is discouraged as reactions run more frequently than necessary.`,
          );
        }
      }
    }

    runInAction(() => {
      const { options } = admin;
      const oldValue = admin.value;
      newValue = options.valueTransform
        ? options.valueTransform(newValue)
        : newValue;
      admin.value = newValue;

      if (isDifferent(oldValue, newValue, options.equals ?? options.comparer)) {
        sendChange(admin, oldValue, newValue);
      }
    });
  }
}

export function observableBox<T>(val?: T, options?: ObservableBoxOptions<T>) {
  return new ObservableBox(val, options);
}
