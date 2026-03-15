/**
 * Minimal className joiner — filters falsy values and joins with space.
 * Avoids pulling in clsx/tailwind-merge for a single utility.
 */
export function cn(
  ...inputs: (string | false | null | undefined | 0)[]
): string {
  return inputs.filter(Boolean).join(" ");
}
