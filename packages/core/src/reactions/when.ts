import { createIdGenerator } from "../utils/idGen";
import { action } from "../transactions/action";
import { Reaction, ReactionWithAdmin } from "./reaction";
import { $fobx } from "../state/global";

const ERR_TIMEOUT = "When reaction hit timeout";
const ERR_CANCEL = "When reaction was canceled";
const ERR_ABORT = "When reaction was aborted";
const getNextId = /* @__PURE__ */ createIdGenerator();

export type WhenPromise = Promise<void> & { cancel: () => void };
export type WhenOptions = {
  timeout?: number;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
};

export function when(predicate: () => boolean, options?: WhenOptions): WhenPromise;
export function when(predicate: () => boolean, sideEffectFn?: () => void, options?: WhenOptions): () => void;
export function when(
  predicate: () => boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectOrOptions: any,
  options?: WhenOptions
): WhenPromise | (() => void) {
  return typeof effectOrOptions !== "function"
    ? createWhenPromise(predicate, effectOrOptions)
    : createWhen(predicate, effectOrOptions, options).dispose;
}

function createWhen(predicate: () => boolean, sideEffectFn: () => void, options?: WhenOptions) {
  const reaction = new Reaction(() => {
    run();
  }, `When@${getNextId()}`) as ReactionWithAdmin;

  let timeoutHandle: ReturnType<typeof setTimeout>;

  if (options?.timeout) {
    timeoutHandle = setTimeout(
      () => {
        if (reaction[$fobx].isDisposed) return;
        reaction.dispose();
        const err = new Error(ERR_TIMEOUT);
        if (options.onError) {
          options.onError(err);
        } else {
          throw err;
        }
      },
      options?.timeout
    );
  }

  const sideEffectAction = action(sideEffectFn, { name: `${reaction[$fobx].name}-sideEffect` });

  const run = () => {
    let value = false;
    reaction.track(() => {
      value = predicate();
    });

    if (value) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      // set 'hasToRun' so that the dispose() will not prevent the side effect from running
      reaction[$fobx].hasToRun = true;
      reaction.dispose();
      sideEffectAction();
    }
  };
  run();
  return reaction;
}

function createWhenPromise(predicate: () => boolean, options?: WhenOptions) {
  if (process.env.NODE_ENV !== "production" && options?.onError) {
    throw new Error("[@fobx/core] Cannot use onError option when using async when.");
  }

  let cancel!: () => void;
  let abort!: () => void;
  const promise = new Promise((resolve, reject) => {
    const reaction = createWhen(predicate, resolve as () => void, { ...options, onError: reject });
    cancel = () => {
      reaction.dispose();
      reject(new Error(ERR_CANCEL));
    };
    abort = () => {
      reaction.dispose();
      reject(new Error(ERR_ABORT));
    };
    options?.signal?.addEventListener("abort", abort);
  }).finally(() => options?.signal?.removeEventListener("abort", abort)) as WhenPromise;
  promise.cancel = cancel;

  return promise;
}
