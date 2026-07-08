export type AuthMode = "remote" | "offline";

export interface LoginRequest {
  userId: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
}
