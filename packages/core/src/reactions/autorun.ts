import { isAction } from "../utils/predicates";
import { createIdGenerator } from "../utils/idGen";
import { Reaction, ReactionWithAdmin } from "./reaction";
import { $fobx, getGlobalState } from "../state/global";

const getNextId = /* @__PURE__ */ createIdGenerator();

const globalState = getGlobalState();

export function autorun(trackedFn: (reaction: Reaction) => void) {
  if (process.env.NODE_ENV !== "production") {
    if (isAction(trackedFn)) {
      throw new Error(`[@fobx/core] Autorun cannot have an action as the tracked function.`);
    }
  }
  const reaction = new Reaction(() => {
    run();
  }, `Autorun@${getNextId()}`) as ReactionWithAdmin;

  const run = () => {
    reaction.track(() => trackedFn(reaction));
  };

  if (globalState.currentlyRunningAction) {
    globalState.pendingReactions.push(reaction[$fobx]);
  } else {
    run();
  }
  return () => {
    reaction.dispose();
  };
}
