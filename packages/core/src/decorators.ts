import { $fobx, observableBox, addObservableAdministration } from "./fobx";
import type { ObservableObjectWithAdmin } from "./observables/observableObject";
import type { ObservableBoxOptions } from "./observables/observableBox";
import type { Any } from "./state/global";

function decorateWithObservable<This, Value>(
  _: unknown,
  context: DecoratorContext,
  options?: ObservableBoxOptions<Value>
): ClassAccessorDecoratorResult<This, Value> {
  if (context.kind !== "accessor") {
    throw new Error(
      "[@fobx/core] @observable decorator must be used with the accessor keyword (i.e. @observable accessor x = 10)."
    );
  }
  const { name } = context;

  return {
    get() {
      // @ts-expect-error - a
      return this[$fobx].values.get(name)!.value;
    },
    set(value) {
      // @ts-expect-error - a
      this[$fobx].values.get(name)!.value = value;
    },
    init(value) {
      // the first decorator applied to object will need to convert the object to an observable
      // @ts-expect-error - a
      if (this[$fobx] === undefined) {
        // @ts-expect-error - a
        addObservableAdministration(this);
      }
      // @ts-expect-error - a
      this[$fobx].values.set(name, observableBox(value, options));
      return value;
    },
  };
}

type DecoratorFn<This, Value> = (
  value: ClassAccessorDecoratorTarget<This, Value>,
  ctx: ClassAccessorDecoratorContext<This, Value>
) => ClassAccessorDecoratorResult<This, Value>;

export function observable<This, Value>(options: { ref: boolean }): DecoratorFn<This, Value>;
export function observable<This, Value>(
  value: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>
): ClassAccessorDecoratorResult<This, Value>;
export function observable<This extends ObservableObjectWithAdmin, Value>(
  valueOrOptions: ClassAccessorDecoratorTarget<This, Value> | { ref: boolean },
  context?: ClassAccessorDecoratorContext<This, Value>
): ClassAccessorDecoratorResult<This, Value> | DecoratorFn<This, Value> {
  if (context === undefined) {
    return function (
      value: ClassAccessorDecoratorTarget<This, Value>,
      ctx: ClassAccessorDecoratorContext<This, Value>
    ) {
      return decorateWithObservable(value, ctx);
    };
  }
  return decorateWithObservable(valueOrOptions, context);
}

type ClassAccessorDecorator<This, Value> = (
  value: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>
) => ClassAccessorDecoratorResult<This, Value>;

export function obs<T, V, O extends ObservableBoxOptions<Any>>(options: O): ClassAccessorDecorator<T, V>;
export function obs<T, V>(
  value: ClassAccessorDecoratorTarget<T, V>,
  context?: ClassAccessorDecoratorContext<T, V>
): ClassAccessorDecoratorResult<T, V>;
export function obs<T, V>(
  value: ClassAccessorDecoratorTarget<T, V>,
  context?: ClassAccessorDecoratorContext<T, V>
): ClassAccessorDecoratorResult<T, V> | ClassAccessorDecorator<T, V> {
  if (context === undefined) {
    const fn = (value: ClassAccessorDecoratorTarget<T, V>, ctx: ClassAccessorDecoratorContext<T, V>) => {
      return decorateWithObservable(value, ctx);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fn as any;
  }

  return decorateWithObservable(value as unknown as ObservableObjectWithAdmin, context!);
}
