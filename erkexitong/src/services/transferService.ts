import Taro from "@tarojs/taro";
import { hasWsBaseUrl } from "./api";
import { websocketClient } from "./websocket";
import { useConnectionStore } from "../stores/useConnectionStore";
import { useEvaluationStore } from "../stores/useEvaluationStore";
import { useNoteStore } from "../stores/useNoteStore";
import { useTransferStore } from "../stores/useTransferStore";
import { useUserStore } from "../stores/useUserStore";
import type {
  EditingItemPayload,
  IncomingTransfer,
  NoteTransferPayload,
  TransferAction,
  TransferPayload
} from "../types/transfer";
import { createId } from "../utils/id";

export function initTransferSync(): void {
  const { token, userId, deviceId, deviceName } = useUserStore.getState();

  if (!token || !userId || !deviceId) {
    return;
  }

  if (!hasWsBaseUrl) {
    useConnectionStore.getState().setMode("offline-demo");
    useConnectionStore.getState().updateDevices([
      { deviceId: "broadcast", deviceName: "我的其他设备", online: true },
      { deviceId: "web-lab", deviceName: "实验室 Web 端", online: true },
      { deviceId: "android-phone", deviceName: "Android 手机端", online: false }
    ]);
  }

  websocketClient.connect({
    token,
    userId,
    deviceId,
    deviceName
  });
}

export function stopTransferSync(): void {
  websocketClient.disconnect();
}

function summarizeTransferPayload(payload: TransferPayload): string {
  if ("content" in payload) {
    const title = payload.title.trim();
    if (title) {
      return title;
    }

    const firstText = payload.content
      .map((block) => ("text" in block ? block.text : ""))
      .join(" ")
      .trim();

    return firstText || "图文内容";
  }

  return payload.text.trim() || "证明材料";
}

export async function sendTransferTo(
  targetDevice: string,
  action: "EDIT_ITEM",
  payload: EditingItemPayload
): Promise<void>;
export async function sendTransferTo(
  targetDevice: string,
  action: "NOTE_CONTENT",
  payload: NoteTransferPayload
): Promise<void>;
export async function sendTransferTo(
  targetDevice: string,
  action: TransferAction,
  payload: TransferPayload
): Promise<void> {
  const connection = useConnectionStore.getState();
  const target = connection.otherDevices.find((device) => device.deviceId === targetDevice);
  const isOfflineDemo = connection.mode === "offline-demo" || !hasWsBaseUrl;
  const messageId = createId("transfer");
  const sentAt = Date.now();

  useTransferStore.getState().addHistory({
    messageId,
    direction: "sent",
    time: sentAt,
    action,
    deviceName: target?.deviceName ?? "我的其他设备",
    summary: summarizeTransferPayload(payload),
    status: isOfflineDemo ? "demo" : "pending",
    targetDevice,
    payload,
    attempts: 1
  });

  if (isOfflineDemo) {
    return;
  }

  if (!connection.isConnected) {
    const error = "WebSocket 未连接，内容未发送";
    useTransferStore.getState().updateDelivery(messageId, "failed", { error });
    throw new Error(error);
  }

  const sent = websocketClient.sendTransfer(messageId, targetDevice, action, payload, sentAt);

  if (!sent) {
    const error = "WebSocket 发送失败，请重试";
    useTransferStore.getState().updateDelivery(messageId, "failed", { error });
    throw new Error(error);
  }
}

export async function retryTransfer(messageId: string): Promise<void> {
  const transferStore = useTransferStore.getState();
  const entry = transferStore.transferHistory.find((candidate) => candidate.messageId === messageId);

  if (!entry || entry.direction !== "sent" || entry.status !== "failed" || !entry.targetDevice || !entry.payload) {
    throw new Error("当前流转记录不可重试");
  }

  const connection = useConnectionStore.getState();
  if (!hasWsBaseUrl || connection.mode === "offline-demo") {
    throw new Error("离线演示记录无需重试");
  }

  if (!connection.isConnected) {
    throw new Error("WebSocket 未连接，请恢复连接后重试");
  }

  const sentAt = Date.now();
  transferStore.markRetrying(messageId, sentAt);
  const sent = websocketClient.sendTransfer(
    messageId,
    entry.targetDevice,
    entry.action,
    entry.payload,
    sentAt
  );

  if (!sent) {
    const error = "WebSocket 发送失败，请稍后重试";
    useTransferStore.getState().updateDelivery(messageId, "failed", { error });
    throw new Error(error);
  }
}

export async function applyIncomingTransfer(transfer?: IncomingTransfer): Promise<void> {
  const incoming = transfer ?? useTransferStore.getState().incomingTransfer;

  if (!incoming) {
    return;
  }

  if (incoming.action === "EDIT_ITEM") {
    await useEvaluationStore.getState().applyTransferPayload(incoming.payload);
    useTransferStore.getState().clearIncoming();
    await Taro.showToast({
      title: "已应用流转内容",
      icon: "success"
    });
  }

  if (incoming.action === "NOTE_CONTENT") {
    useNoteStore.getState().applyIncomingContent(incoming.payload);
    useTransferStore.getState().clearIncoming();
    await Taro.showToast({
      title: "已应用图文内容",
      icon: "success"
    });
  }
}

export async function promptApplyIncomingTransfer(incoming: IncomingTransfer): Promise<void> {
  const hasLocalChanges =
    incoming.action === "NOTE_CONTENT"
      ? useNoteStore.getState().isDirty
      : Object.values(useEvaluationStore.getState().records).some((records) =>
          records.some((record) => record.dirty)
        );
  const prefix = hasLocalChanges ? "当前有未保存修改，" : "";
  const content = incoming.action === "NOTE_CONTENT"
    ? `${prefix}来自 ${incoming.fromDevice || "其他设备"} 的图文草稿，覆盖当前编辑内容？`
    : `${prefix}来自 ${incoming.fromDevice || "其他设备"} 的材料，应用到当前草稿？`;

  const result = await Taro.showModal({
    title: "收到流转内容",
    content,
    confirmText: "应用",
    cancelText: "稍后"
  });

  if (result.confirm) {
    await applyIncomingTransfer(incoming);
  }
}
