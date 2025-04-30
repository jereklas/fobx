// @ts-ignore - to suppress tsc false error
import { useEffect, useRef, useState } from "react"
// @ts-ignore - to suppress tsc false error
import { getGlobalState as getFobxState, observable } from "@fobx/core"
import { getGlobalState } from "../state/global.ts"
const globalState = getGlobalState()
const fobxState = getFobxState()

// deno-lint-ignore no-explicit-any
export interface IViewModel<VM extends new (...args: any) => any> {
  update(...args: ConstructorParameters<VM>): void
  onConnect(): void
  onDisconnect(): void
}

export class ViewModel<
  T extends object = object,
  E extends Element = HTMLElement,
> implements IViewModel<typeof ViewModel> {
  // @ts-expect-error - when no props are supplied give default empty object
  constructor(props: T = {}) {
    const annotations: Record<string, "observable"> = {}
    // spreading to remove all non-enumerable props (e.g. react's ref prop)
    const newProps = { ...props }
    Object.entries(newProps).forEach(([key]) => {
      annotations[key] = "observable"
    })
    this._props = observable(newProps, annotations, { shallow: true })
    observable(this, {}, { shallow: true })
  }

  get props(): T {
    return this._props
  }
  private _props: T

  ref: E | null = null

  setRef: (el: E | null) => void = (el) => {
    this.ref = el
  }

  onConnect(): void {}

  onDisconnect(): void {}

  update(props: Partial<T>): void {
    Object.assign(this._props, props)
  }
}

export function useViewModel<
  T extends InstanceType<U>,
  // deno-lint-ignore no-explicit-any
  U extends new (...args: any) => any,
>(
  ctor: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  const isFirstRender = useRef(true)
  const reaction = useRef(fobxState.reactionContext)

  const [vm] = useState(() => new ctor(...args) as IViewModel<T>)

  if (!isFirstRender.current) {
    const prev = globalState.updatingReaction
    globalState.updatingReaction = reaction.current
    try {
      vm.update(...args)
    } finally {
      globalState.updatingReaction = prev
    }
  }
  isFirstRender.current = false

  useEffect(() => {
    vm.onConnect()
    return () => vm.onDisconnect()
  }, [vm])

  return vm as InstanceType<T>
}
