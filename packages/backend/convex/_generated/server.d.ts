import { queryGeneric, mutationGeneric, actionGeneric, internalQueryGeneric, internalMutationGeneric, internalActionGeneric } from "convex/server";

export const query: typeof queryGeneric;
export const mutation: typeof mutationGeneric;
export const action: typeof actionGeneric;
export const internalQuery: typeof internalQueryGeneric;
export const internalMutation: typeof internalMutationGeneric;
export const internalAction: typeof internalActionGeneric;
