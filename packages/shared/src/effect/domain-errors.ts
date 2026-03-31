import { Data } from "effect";

export class TransitionError extends Data.TaggedError("TransitionError")<{
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}> {
  get message() {
    return `Cannot transition from "${this.from}" to "${this.to}": ${this.reason}`;
  }
}
