import type { TransferAckPayload, TransferDeliveryStatus, WebSocketDevice } from "../types/transfer";

export function getSelectableTransferDevices(devices: WebSocketDevice[]): WebSocketDevice[] {
  return devices.filter((device) => device.online && device.deviceId !== "broadcast");
}

export function getTransferDeliveryLabel(status: TransferDeliveryStatus, attempts = 1): string {
  if (status === "pending") {
    return attempts > 1 ? `重试待确认 · ${attempts} 次` : "等待确认";
  }

  if (status === "delivered") {
    return "已送达";
  }

  if (status === "failed") {
    return attempts > 1 ? `重试失败 · ${attempts} 次` : "发送失败";
  }

  if (status === "demo") {
    return "演示记录";
  }

  return "已接收";
}

export function formatTransferTime(time?: number): string {
  if (!time || !Number.isFinite(time)) {
    return "";
  }

  const date = new Date(time);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function normalizeTransferAckPayload(value: unknown): TransferAckPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const messageId = typeof candidate.messageId === "string" ? candidate.messageId.trim() : "";
  const status = candidate.status;

  if (!messageId || (status !== "delivered" && status !== "failed")) {
    return null;
  }

  return {
    messageId,
    status,
    serverTime:
      typeof candidate.serverTime === "number" && Number.isFinite(candidate.serverTime)
        ? candidate.serverTime
        : undefined,
    error: typeof candidate.error === "string" && candidate.error.trim() ? candidate.error.trim() : undefined
  };
}
