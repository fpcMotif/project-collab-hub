const formatLog = (
  level: string,
  message: string,
  context?: unknown
): string => {
  let ctxStr = "";
  if (context instanceof Error) {
    ctxStr = ` - ${context.message}\n${context.stack ?? ""}`;
  } else if (context !== undefined) {
    try {
      ctxStr = ` - ${JSON.stringify(context)}`;
    } catch {
      ctxStr = ` - [Unserializable Context]`;
    }
  }
  return `[${level}] ${message}${ctxStr}`;
};

export const logger = {
  error: (message: string, context?: unknown) => {
    console.error(formatLog("ERROR", message, context));
  },
  info: (message: string, context?: unknown) => {
    console.info(formatLog("INFO", message, context));
  },
  log: (message: string, context?: unknown) => {
    console.log(formatLog("LOG", message, context));
  },
  warn: (message: string, context?: unknown) => {
    console.warn(formatLog("WARN", message, context));
  },
};
