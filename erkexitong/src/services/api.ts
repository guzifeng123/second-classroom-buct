import Taro from "@tarojs/taro";
import { useUserStore } from "../stores/useUserStore";

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
}

export class ApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
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
    throw new ApiError(message);
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(getResponseMessage(response.data, response.statusCode), response.statusCode);
  }

  return response.data;
}

export function getErrorMessage(error: unknown, fallback = "操作失败"): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
