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

  if (!isOfflineDemo) {
    websocketClient.sendTransfer(targetDevice, action, payload);
  }

  useTransferStore.getState().addHistory({
    direction: "sent",
    time: Date.now(),
    action,
    deviceName: target?.deviceName ?? "我的其他设备",
    summary: summarizeTransferPayload(payload)
  });
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
