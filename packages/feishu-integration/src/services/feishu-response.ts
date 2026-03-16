export interface FeishuApiResponse<TData> {
  readonly code?: number;
  readonly msg?: string;
  readonly data?: TData;
}

const toErrorCause = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const getFeishuFailureMessage = (
  response: Pick<FeishuApiResponse<unknown>, "code" | "msg">
): string => {
  const message = response.msg?.trim();

  if (typeof response.code === "number" && message) {
    return `Feishu API failed with code ${response.code}: ${message}`;
  }

  if (typeof response.code === "number") {
    return `Feishu API failed with code ${response.code}`;
  }

  if (message) {
    return `Feishu API failed: ${message}`;
  }

  return "Feishu API failed: Missing response code";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const wrapFeishuError = (prefix: string, error: unknown): Error =>
  new Error(
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
    { cause: toErrorCause(error) }
  );

export const assertFeishuSuccess = <TData>(
  response: FeishuApiResponse<TData>
): void => {
  if (response.code === 0) {
    return;
  }

  throw new Error(getFeishuFailureMessage(response));
};

export const getFeishuData = <TData>(
  response: FeishuApiResponse<TData>
): TData => {
  assertFeishuSuccess(response);

  if (response.data === undefined || response.data === null) {
    throw new Error("No data in response");
  }

  return response.data;
};

export const getFeishuObjectData = (
  response: FeishuApiResponse<unknown>
): Record<string, unknown> => {
  const data = getFeishuData(response);

  if (!isRecord(data)) {
    throw new Error("Expected object data in response");
  }

  return data;
};
