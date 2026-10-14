import type { EvaluationSyncStatus } from "../types/evaluation";

export type EvaluationSyncErrorCategory = "network" | "permission" | "validation" | "unknown";
export type SyncErrorInput =
  | string
  | {
      message?: string | null;
      code?: string | null;
      statusCode?: number | null;
    }
  | null
  | undefined;

const PERMISSION_ERROR_PATTERN =
  /(?:^|\D)(?:401|403)(?:\D|$)|未授权|无权限|权限|登录失效|token|forbidden|unauthorized/i;
const VALIDATION_ERROR_PATTERN =
  /(?:^|\D)(?:400|409|422)(?:\D|$)|校验|参数|字段|格式|冲突|validation|invalid/i;
const NETWORK_ERROR_PATTERN =
  /网络|超时|连接|离线|request:fail|timeout|network|fetch|econn|enotfound/i;

const PERMISSION_ERROR_CODES = new Set([
  "AUTH_EXPIRED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "PERMISSION_DENIED",
  "TOKEN_EXPIRED"
]);
const VALIDATION_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "INVALID_DRAFT",
  "DRAFT_CONFLICT",
  "BAD_REQUEST",
  "CONFLICT"
]);
const NETWORK_ERROR_CODES = new Set(["NETWORK_ERROR", "TIMEOUT", "OFFLINE", "REQUEST_FAILED", "FETCH_FAILED"]);

function normalizeErrorCode(code?: string | null): string {
  return code?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
}

function normalizeSyncErrorInput(input: SyncErrorInput): {
  message: string;
  code: string;
  statusCode: number | null;
} {
  if (typeof input === "string") {
    return {
      message: input.trim(),
      code: "",
      statusCode: null
    };
  }

  return {
    message: input?.message?.trim() ?? "",
    code: normalizeErrorCode(input?.code),
    statusCode: input?.statusCode ?? null
  };
}

export function classifySyncError(error?: SyncErrorInput): EvaluationSyncErrorCategory {
  const { message, code, statusCode } = normalizeSyncErrorInput(error);

  if (PERMISSION_ERROR_CODES.has(code) || statusCode === 401 || statusCode === 403) {
    return "permission";
  }

  if (
    VALIDATION_ERROR_CODES.has(code) ||
    statusCode === 400 ||
    statusCode === 409 ||
    statusCode === 422
  ) {
    return "validation";
  }

  if (NETWORK_ERROR_CODES.has(code)) {
    return "network";
  }

  if (PERMISSION_ERROR_PATTERN.test(message)) {
    return "permission";
  }

  if (VALIDATION_ERROR_PATTERN.test(message)) {
    return "validation";
  }

  if (NETWORK_ERROR_PATTERN.test(message)) {
    return "network";
  }

  return "unknown";
}

export function getSyncErrorLabel(error?: SyncErrorInput): string {
  const category = classifySyncError(error);

  if (category === "network") {
    return "网络异常";
  }

  if (category === "permission") {
    return "权限异常";
  }

  if (category === "validation") {
    return "数据校验失败";
  }

  return "未知同步异常";
}

export function getSyncErrorDisplay(error?: SyncErrorInput): string {
  const category = classifySyncError(error);

  if (category === "network") {
    return "网络异常：请检查网络连接后重试。";
  }

  if (category === "permission") {
    return "权限异常：登录可能已失效，请重新登录后重试。";
  }

  if (category === "validation") {
    return "数据校验失败：请检查填报内容后再重试。";
  }

  return "未知同步异常：请稍后重试，持续失败请联系管理员。";
}

export function getSyncStatusText(syncStatus: EvaluationSyncStatus): string {
  if (syncStatus === "local-unsaved") {
    return "本地未保存";
  }

  if (syncStatus === "local-saved") {
    return "本地已保存";
  }

  if (syncStatus === "remote-syncing") {
    return "远端同步中";
  }

  if (syncStatus === "remote-synced") {
    return "远端已同步";
  }

  return "同步失败";
}

export function formatSavedAt(savedAt: number | null): string {
  if (!savedAt) {
    return "";
  }

  const date = new Date(savedAt);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function getSyncStatusDisplay(syncStatus: EvaluationSyncStatus, savedAt: number | null): string {
  const syncStatusText = getSyncStatusText(syncStatus);
  const savedAtText = formatSavedAt(savedAt);

  return savedAtText ? `${syncStatusText} · ${savedAtText}` : syncStatusText;
}
