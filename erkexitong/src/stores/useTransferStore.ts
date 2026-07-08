import { create } from "zustand";
import type {
  EditingItemPayload,
  IncomingTransfer,
  TransferAction,
  TransferHistoryEntry,
  TransferPayload
} from "../types/transfer";

interface TransferState {
  editingItem: EditingItemPayload | null;
  incomingTransfer: IncomingTransfer | null;
  transferHistory: TransferHistoryEntry[];
  setEditingItem: (item: EditingItemPayload | null) => void;
  clearEditingItem: () => void;
  receiveIncoming: (transfer: IncomingTransfer) => void;
  clearIncoming: () => void;
  addHistory: (entry: TransferHistoryEntry) => void;
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
          direction: "received",
          time: incomingTransfer.time,
          action: incomingTransfer.action,
          deviceName: incomingTransfer.fromDevice,
          summary: summarize(incomingTransfer.action, incomingTransfer.payload)
      };

      return {
        incomingTransfer,
        transferHistory: [entry, ...state.transferHistory].slice(0, 5)
      };
    }),
  clearIncoming: () => set({ incomingTransfer: null }),
  addHistory: (entry) =>
    set((state) => ({
      transferHistory: [entry, ...state.transferHistory].slice(0, 5)
    }))
}));
