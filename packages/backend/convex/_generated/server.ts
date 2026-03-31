export const query = (obj: any) => { return { ...obj, isApiFunctionReference: true, isQueryReference: true } as any };
export const mutation = (obj: any) => { return { ...obj, isApiFunctionReference: true, isMutationReference: true } as any };
export const action = (obj: any) => { return { ...obj, isApiFunctionReference: true, isActionReference: true } as any };
export const internalQuery = (obj: any) => { return { ...obj, isApiFunctionReference: true, isQueryReference: true } as any };
export const internalMutation = (obj: any) => { return { ...obj, isApiFunctionReference: true, isMutationReference: true } as any };
export const internalAction = (obj: any) => { return { ...obj, isApiFunctionReference: true, isActionReference: true } as any };
export const httpAction = (obj: any) => { return { ...obj, isApiFunctionReference: true, isHttpActionReference: true } as any };
