import type { ObservableBox } from "../../../index.ts"

export function setObservedBoxOutsideTransaction(
  box: ObservableBox<number>,
): void {
  box.set(2) // STACK_MARKER_FIXTURE_SET
}

export function changeObservedBox(box: ObservableBox<number>): void {
  setObservedBoxOutsideTransaction(box) // STACK_MARKER_FIXTURE_CHANGE
}
