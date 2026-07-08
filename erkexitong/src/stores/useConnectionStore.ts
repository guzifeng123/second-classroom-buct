import { create } from "zustand";
import type { WebSocketDevice } from "../types/transfer";

export type ConnectionMode = "offline-demo" | "remote" | "disconnected";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  mode: ConnectionMode;
  otherDevices: WebSocketDevice[];
  setConnected: (value: boolean) => void;
  setReconnecting: (value: boolean) => void;
  setMode: (mode: ConnectionMode) => void;
  addRetry: () => void;
  resetRetry: () => void;
  updateDevices: (list: WebSocketDevice[]) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: false,
  isReconnecting: false,
  retryCount: 0,
  mode: "disconnected",
  otherDevices: [],
  setConnected: (isConnected) => set({ isConnected, mode: isConnected ? "remote" : "disconnected" }),
  setReconnecting: (isReconnecting) => set({ isReconnecting }),
  setMode: (mode) =>
    set((state) => ({
      mode,
      isConnected: mode === "remote",
      isReconnecting: mode === "disconnected" ? false : state.isReconnecting
    })),
  addRetry: () => set((state) => ({ retryCount: state.retryCount + 1 })),
  resetRetry: () => set({ retryCount: 0 }),
  updateDevices: (otherDevices) => set({ otherDevices })
}));
