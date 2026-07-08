import { hasApiBaseUrl, request } from "./api";
import type { LoginRequest, LoginResponse } from "../types/auth";

export async function loginWithUserId(userId: string): Promise<LoginResponse> {
  if (!hasApiBaseUrl) {
    return {
      userId,
      token: `offline-token-${userId}-${Date.now()}`
    };
  }

  return request<LoginResponse, LoginRequest>({
    url: "/login",
    method: "POST",
    data: { userId }
  });
}

export function isOfflineAuthMode(): boolean {
  return !hasApiBaseUrl;
}
