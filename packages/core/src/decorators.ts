import type {
  Any,
  ObservableObjectWithAdmin,
  ObservableValueOptions,
} from "./types";

import {
  $fobx,
  createObservableValue,
  addObservableAdministration,
} from "./fobx";

function decorateWithObservable<This, Value>(
  _: unknown,
  context: DecoratorContext,
  options?: ObservableValueOptions<Value>,
): ClassAccessorDecoratorResult<This, Value> {
  if (context.kind !== "accessor") {
    throw new Error(
      "[@fobx/core] @observable decorator must be used with the accessor keyword (i.e. @observable accessor x = 10).",
    );
  }
  const { name } = context;

  return {
    get() {
      // @ts-expect-error
      return this[$fobx].values.get(name)!.value;
    },
    set(value) {
      // @ts-expect-error
      this[$fobx].values.get(name)!.value = value;
    },
    init(value) {
      // the first decorator applied to object will need to convert the object to an observable
      // @ts-expect-error
      if (this[$fobx] === undefined) {
        // @ts-expect-error
        addObservableAdministration(this);
      }
      // @ts-expect-error
      this[$fobx].values.set(name, createObservableValue(value, options));
      return value;
    },
  };
}

type DecoratorFn<This, Value> = (
  value: ClassAccessorDecoratorTarget<This, Value>,
  ctx: ClassAccessorDecoratorContext<This, Value>,
) => ClassAccessorDecoratorResult<This, Value>;

export function observable<This, Value>(options: {
  ref: boolean;
}): DecoratorFn<This, Value>;
export function observable<This, Value>(
  value: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value>;
export function observable<This extends ObservableObjectWithAdmin, Value>(
  valueOrOptions: ClassAccessorDecoratorTarget<This, Value> | { ref: boolean },
  context?: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> | DecoratorFn<This, Value> {
  if (context === undefined) {
    return function (
      value: ClassAccessorDecoratorTarget<This, Value>,
      ctx: ClassAccessorDecoratorContext<This, Value>,
    ) {
      return decorateWithObservable(value, ctx);
    };
  }
  return decorateWithObservable(valueOrOptions, context);
}

type ClassAccessorDecorator<This, Value> = (
  value: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
) => ClassAccessorDecoratorResult<This, Value>;

export function obs<T, V, O extends ObservableValueOptions<Any>>(
  options: O,
): ClassAccessorDecorator<T, V>;
export function obs<T, V>(
  value: ClassAccessorDecoratorTarget<T, V>,
  context?: ClassAccessorDecoratorContext<T, V>,
): ClassAccessorDecoratorResult<T, V>;
export function obs<T, V>(
  value: ClassAccessorDecoratorTarget<T, V>,
  context?: ClassAccessorDecoratorContext<T, V>,
): ClassAccessorDecoratorResult<T, V> | ClassAccessorDecorator<T, V> {
  if (context === undefined) {
    const fn = (
      value: ClassAccessorDecoratorTarget<T, V>,
      ctx: ClassAccessorDecoratorContext<T, V>,
    ) => {
      return decorateWithObservable(value, ctx);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fn as any;
  }

  return decorateWithObservable(
    value as unknown as ObservableObjectWithAdmin,
    context!,
  );
}
