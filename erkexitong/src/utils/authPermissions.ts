import type { UserRole } from "../types/auth";

export const DEFAULT_USER_ROLE: UserRole = "student";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "学生",
  class_committee: "班委",
  counselor: "辅导员",
  admin: "管理员"
};

const ADMIN_CAPABLE_ROLES = new Set<UserRole>(["class_committee", "counselor", "admin"]);

export function normalizeUserRole(role?: string): UserRole {
  if (role === "class_committee" || role === "counselor" || role === "admin" || role === "student") {
    return role;
  }

  return DEFAULT_USER_ROLE;
}

export function inferOfflineUserRole(userId: string): UserRole {
  const normalized = userId.trim().toLowerCase();

  if (/^(admin|administrator|manager)[-_]/.test(normalized) || normalized === "admin") {
    return "admin";
  }

  if (/^(counselor|teacher|reviewer|advisor)[-_]/.test(normalized) || normalized === "counselor") {
    return "counselor";
  }

  if (/^(committee|monitor|class-committee|class_committee)[-_]/.test(normalized) || normalized === "monitor") {
    return "class_committee";
  }

  return DEFAULT_USER_ROLE;
}

export function getUserRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function canAccessAdminMode(role: UserRole): boolean {
  return ADMIN_CAPABLE_ROLES.has(role);
}
