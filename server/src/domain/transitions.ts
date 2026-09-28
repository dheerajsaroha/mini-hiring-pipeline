import { Stage, STAGES, TERMINAL_STAGES, isTerminalStage, getNextStage, canTransition } from "shared";

export { Stage, STAGES, TERMINAL_STAGES, isTerminalStage, getNextStage, canTransition };

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function validateTransition(from: Stage, to: Stage): void {
  if (!canTransition(from, to)) {
    if (from === to) {
      throw new TransitionError(`Already at stage ${from}`);
    }
    if (isTerminalStage(from)) {
      throw new TransitionError(`Cannot move from terminal stage ${from}`);
    }
    const next = getNextStage(from);
    if (to === "Rejected") {
      throw new TransitionError(`Cannot reject from ${from}`);
    }
    throw new TransitionError(
      `Can't move from ${from} to ${to}. Next stage is ${next}.`
    );
  }
}