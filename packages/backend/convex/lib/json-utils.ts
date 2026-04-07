export const parseJsonSafely = (
  bodyText: string
): Record<string, unknown> | null => {
  if (!bodyText) {
    return null;
  }
  try {
    const parsed = JSON.parse(bodyText);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};
