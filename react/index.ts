export { observer } from "./hof/observer.ts"
export { getGlobalState } from "./state/global.ts"
export * from "./hooks/useViewModel.ts"
// Alias VM to Controller
export {
  useViewModel as useController,
  ViewModel as Controller,
} from "./hooks/useViewModel.ts"
