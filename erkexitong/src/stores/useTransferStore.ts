import { create } from "zustand";
import type {
  EditingItemPayload,
  IncomingTransfer,
  TransferAction,
  TransferHistoryEntry,
  TransferPayload,
  TransferDeliveryStatus
} from "../types/transfer";
import { createId } from "../utils/id";

interface TransferState {
  editingItem: EditingItemPayload | null;
  incomingTransfer: IncomingTransfer | null;
  transferHistory: TransferHistoryEntry[];
  setEditingItem: (item: EditingItemPayload | null) => void;
  clearEditingItem: () => void;
  receiveIncoming: (transfer: IncomingTransfer) => void;
  clearIncoming: () => void;
  addHistory: (entry: TransferHistoryEntry) => void;
  updateDelivery: (
    messageId: string,
    status: TransferDeliveryStatus,
    details?: { serverTime?: number; error?: string }
  ) => void;
  markRetrying: (messageId: string, time: number) => void;
}

function summarizeNoteContent(payload: TransferPayload): string {
  if (!("content" in payload)) {
    const trimmed = payload.text.trim();
    return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed || "证明材料";
  }

  const title = payload.title.trim();
  if (title) {
    return title.length > 18 ? `${title.slice(0, 18)}...` : title;
  }

  const firstText = payload.content
    .map((block) => ("text" in block ? block.text : ""))
    .join(" ")
    .trim();

  if (!firstText) {
    return payload.content.some((block) => block.type === "image") ? "图文内容" : "空白草稿";
  }

  return firstText.length > 18 ? `${firstText.slice(0, 18)}...` : firstText;
}

function summarize(action: TransferAction, payload: TransferPayload): string {
  if (action === "NOTE_CONTENT") {
    return summarizeNoteContent(payload);
  }

  return summarizeNoteContent(payload);
}

export const useTransferStore = create<TransferState>((set) => ({
  editingItem: null,
  incomingTransfer: null,
  transferHistory: [],
  setEditingItem: (editingItem) => set({ editingItem }),
  clearEditingItem: () => set({ editingItem: null }),
  receiveIncoming: (incomingTransfer) =>
    set((state) => {
      const entry: TransferHistoryEntry = {
        messageId: incomingTransfer.messageId ?? createId("received"),
        direction: "received",
        time: incomingTransfer.time,
        action: incomingTransfer.action,
        deviceName: incomingTransfer.fromDevice,
        summary: summarize(incomingTransfer.action, incomingTransfer.payload),
        status: "received",
        attempts: 1,
        serverTime: incomingTransfer.serverTime
      };

      return {
        incomingTransfer,
        transferHistory: [entry, ...state.transferHistory].slice(0, 8)
      };
    }),
  clearIncoming: () => set({ incomingTransfer: null }),
  addHistory: (entry) =>
    set((state) => ({
      transferHistory: [entry, ...state.transferHistory].slice(0, 8)
    })),
  updateDelivery: (messageId, status, details = {}) =>
    set((state) => ({
      transferHistory: state.transferHistory.map((entry) =>
        entry.messageId === messageId
          ? {
              ...entry,
              status,
              serverTime: details.serverTime ?? entry.serverTime,
              error: details.error
            }
          : entry
      )
    })),
  markRetrying: (messageId, time) =>
    set((state) => ({
      transferHistory: state.transferHistory.map((entry) =>
        entry.messageId === messageId
          ? {
              ...entry,
              time,
              status: "pending",
              attempts: entry.attempts + 1,
              serverTime: undefined,
              error: undefined
            }
          : entry
      )
    }))
}));
