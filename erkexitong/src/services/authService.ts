import { hasApiBaseUrl, request } from "./api";
import type { LoginRequest, LoginResponse } from "../types/auth";
import { inferOfflineUserRole } from "../utils/authPermissions";

export async function loginWithUserId(userId: string): Promise<LoginResponse> {
  if (!hasApiBaseUrl) {
    return {
      userId,
      token: `offline-token-${userId}-${Date.now()}`,
      role: inferOfflineUserRole(userId)
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
