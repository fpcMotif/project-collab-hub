import { ConvexHttpClient } from "convex/browser";

export function getConvexServerClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  return new ConvexHttpClient(url);
}

export async function runMutation<TArgs extends Record<string, unknown>, TResult>(
  name: string,
  args: TArgs,
) {
  const client = getConvexServerClient();
  return client.mutation(name as never, args) as Promise<TResult>;
}

export async function runQuery<TArgs extends Record<string, unknown>, TResult>(
  name: string,
  args: TArgs,
) {
  const client = getConvexServerClient();
  return client.query(name as never, args) as Promise<TResult>;
}
