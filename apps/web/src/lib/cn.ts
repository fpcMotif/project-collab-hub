/**
 * Minimal className joiner — filters falsy values and joins with space.
 * Avoids pulling in clsx/tailwind-merge for a single utility.
 */
export const cn = (...inputs: (string | false | null | undefined | 0)[]): string =>
  inputs.filter(Boolean).join(" ");
