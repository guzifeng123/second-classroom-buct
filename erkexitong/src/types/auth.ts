export type AuthMode = "remote" | "offline";
export type UserRole = "student" | "class_committee" | "counselor" | "admin";

export interface LoginRequest {
  userId: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  role?: UserRole;
}
