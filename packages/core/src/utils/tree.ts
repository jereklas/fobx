import type { IObservableValueAdmin } from "../observables/observableValue";
import type { IComputedAdmin } from "../reactions/computed";
import { $fobx, type IFobxAdmin } from "../state/global";
import { isObject } from "./predicates";

export interface IDependencyTree {
  name: string;
  path: string;
  dependencies: IDependencyTree[];
}

export interface IObserverTree {
  name: string;
  path: string;
  observers: IObserverTree[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDependencyTree(obj: any) {
  if (hasFobxAdministration(obj)) {
    obj = obj[$fobx];
  }

  const node: IDependencyTree = {
    name: obj.name,
    path: obj.path ?? "",
    dependencies: [],
  };
  if ("dependencies" in obj) {
    (obj as IComputedAdmin).dependencies.forEach((o) => {
      node.dependencies.push(getDependencyTree(o));
    });
  }
  return node;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getObserverTree(obj: any) {
  if (hasFobxAdministration(obj)) {
    obj = obj[$fobx];
  }

  const node: IObserverTree = {
    name: obj.name,
    path: obj.path ?? "",
    observers: [],
  };
  if ("observers" in obj) {
    (obj as IObservableValueAdmin).observers.forEach((o) => {
      node.observers.push(getObserverTree(o));
    });
  }
  return node;
}

function hasFobxAdministration(obj: unknown): obj is { [$fobx]: IFobxAdmin } {
  return isObject(obj) && $fobx in obj && isObject(obj[$fobx]);
}
