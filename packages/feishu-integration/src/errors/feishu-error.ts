import { Data } from "effect";

export class FeishuError extends Data.TaggedError("FeishuError")<{
  readonly message: string;
}> {}
