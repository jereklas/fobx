import { Reaction, ReactionAdmin, type ReactionWithAdmin } from "./reaction.ts"
import { $fobx, getGlobalState } from "../state/global.ts"
import { isAction } from "../utils/predicates.ts"

const globalState = /* @__PURE__ */ getGlobalState()

export function autorun(trackedFn: (reaction: Reaction) => void): () => void {
  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production") {
    if (isAction(trackedFn)) {
      throw new Error(
        `[@fobx/core] Autorun cannot have an action as the tracked function.`,
      )
    }
  }
  const reaction = new Reaction(
    new ReactionAdmin(() => {
      run()
    }, "Autorun"),
  ) as ReactionWithAdmin

  const run = () => {
    reaction.track(() => trackedFn(reaction))
  }

  if (globalState.currentlyRunningAction) {
    globalState.pendingReactions.push(reaction[$fobx])
  } else {
    run()
  }
  return () => {
    reaction.dispose()
  }
}
