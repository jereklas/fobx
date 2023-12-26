// TODO: make this only the public interfaces. internal types should just be imported from their respective locations
import type { IObservableValueAdmin, ObservableValueWithAdmin } from "./observables/observableValue";
import type { ObservableObjectWithAdmin } from "./observables/observableObject";
import type { ObservableArrayWithAdmin } from "./observables/observableArray";
import type { ObservableMapWithAdmin } from "./observables/observableMap";
import type { ObservableSetWithAdmin } from "./observables/observableSet";

export type * from "./reactions/reaction";
export type * from "./reactions/when";
export type * from "./reactions/autorun";
export type * from "./reactions/computed";

export type * from "./transactions/action";
export type * from "./transactions/flow";
export type * from "./transactions/tracking";

export type * from "./observables/observable";
export type * from "./observables/notifications";
export type * from "./observables/observableValue";
export type * from "./observables/observableMap";
export type * from "./observables/observableSet";
export type * from "./observables/observableObject";
export type * from "./observables/observableArray";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export type Disposer = () => void;

export type ComparisonType = "default" | "structural";
export type EqualityChecker = (a: Any, b: Any) => boolean;

export interface IFobxAdmin {
  name: string;
}

export type IObservable =
  | ObservableValueWithAdmin
  | ObservableObjectWithAdmin
  | ObservableArrayWithAdmin
  | ObservableMapWithAdmin
  | ObservableSetWithAdmin;

export interface IObservableCollectionAdmin<T = Any> extends IObservableValueAdmin<T> {
  getNextChangeId: () => number;
  changes: number;
  previous: string;
  current: string;
}
