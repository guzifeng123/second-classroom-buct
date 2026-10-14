import Taro from "@tarojs/taro";
import { useUserStore } from "../stores/useUserStore";
import { recordApiFailure } from "../utils/monitoring";

const runtimeEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const API_BASE_URL = runtimeEnv.TARO_APP_API_BASE_URL || "";
export const WS_BASE_URL = runtimeEnv.TARO_APP_WS_BASE_URL || "";
export const hasApiBaseUrl = API_BASE_URL.trim().length > 0;
export const hasWsBaseUrl = WS_BASE_URL.trim().length > 0;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions<TBody> {
  url: string;
  method?: HttpMethod;
  data?: TBody;
  header?: Record<string, string>;
}

interface ErrorResponseShape {
  message?: string;
  error?: string;
  code?: string;
  errorCode?: string;
  error_code?: string;
}

export class ApiError extends Error {
  statusCode?: number;
  errorCode?: string;

  constructor(message: string, statusCode?: number, errorCode?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function getResponseMessage(data: unknown, statusCode: number): string {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const shape = data as ErrorResponseShape;
    if (shape.message) {
      return shape.message;
    }
    if (shape.error) {
      return shape.error;
    }
  }

  return `请求失败：${statusCode}`;
}

function getResponseErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const shape = data as ErrorResponseShape;
  return shape.code ?? shape.errorCode ?? shape.error_code;
}

export async function request<TResponse, TBody = unknown>({
  url,
  method = "GET",
  data,
  header
}: RequestOptions<TBody>): Promise<TResponse> {
  const { token } = useUserStore.getState();
  let response: {
    statusCode: number;
    data: TResponse;
  };

  try {
    response = await Taro.request<TResponse>({
      url: `${API_BASE_URL}${url}`,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header
      }
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "网络请求失败";
    recordApiFailure({
      url,
      method,
      message
    });
    throw new ApiError(message, undefined, "NETWORK_ERROR");
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = getResponseMessage(response.data, response.statusCode);
    const errorCode = getResponseErrorCode(response.data);
    recordApiFailure({
      url,
      method,
      statusCode: response.statusCode,
      message
    });
    throw new ApiError(message, response.statusCode, errorCode);
  }

  return response.data;
}

export function getErrorMessage(error: unknown, fallback = "操作失败"): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
