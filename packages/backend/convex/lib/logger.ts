/**
 * Structured logger utility for the Convex backend.
 * Automatically extracts stack traces from Error objects to ensure they are
 * visible in the Convex dashboard.
 */

const formatArgs = (args: unknown[]) =>
  args.map((arg) => {
    if (arg instanceof Error) {
      return {
        message: arg.message,
        name: arg.name,
        stack: arg.stack,
      };
    }
    return arg;
  });

export const logger = {
  error: (...args: unknown[]) => console.error(...formatArgs(args)),
  info: (...args: unknown[]) => console.info(...formatArgs(args)),
  log: (...args: unknown[]) => console.log(...formatArgs(args)),
  warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
};
