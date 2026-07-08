import Taro from "@tarojs/taro";
import { useConnectionStore } from "../stores/useConnectionStore";
import { useTransferStore } from "../stores/useTransferStore";
import type {
  IncomingTransfer,
  TransferAction,
  TransferPayload,
  WebSocketDevice,
  WebSocketEnvelope
} from "../types/transfer";
import { WS_BASE_URL, hasWsBaseUrl } from "./api";

interface ConnectParams {
  token: string;
  userId: string;
  deviceId: string;
  deviceName: string;
}

interface DeviceListPayload {
  devices?: WebSocketDevice[];
}

const MAX_RETRY_COUNT = 5;
const HEARTBEAT_INTERVAL = 30000;

class WebSocketClient {
  private socketTask: Taro.SocketTask | null = null;
  private params: ConnectParams | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  connect(params: ConnectParams): void {
    this.disconnect(false);

    if (!hasWsBaseUrl) {
      useConnectionStore.getState().setMode("offline-demo");
      useConnectionStore.getState().setReconnecting(false);
      return;
    }

    useConnectionStore.getState().setMode("disconnected");
    this.params = params;
    this.manuallyClosed = false;
    void this.openSocket(params);
  }

  private async openSocket(params: ConnectParams): Promise<void> {
    const socketTask = await Taro.connectSocket({
      url: `${WS_BASE_URL}?userId=${encodeURIComponent(params.userId)}&deviceId=${encodeURIComponent(
        params.deviceId
      )}`,
      header: {
        Authorization: `Bearer ${params.token}`
      }
    });

    if (this.manuallyClosed) {
      socketTask.close({});
      return;
    }

    this.socketTask = socketTask;

    socketTask.onOpen(() => {
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setReconnecting(false);
      useConnectionStore.getState().resetRetry();
      this.startHeartbeat();
      this.send("auth", {
        token: params.token,
        deviceId: params.deviceId,
        deviceName: params.deviceName
      });
      this.send("join", {
        room: params.userId,
        deviceId: params.deviceId
      });
    });

    socketTask.onMessage((message: { data: string | ArrayBuffer }) => {
      this.handleMessage(message.data);
    });

    socketTask.onClose(() => {
      useConnectionStore.getState().setConnected(false);
      this.stopHeartbeat();
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    });

    socketTask.onError(() => {
      useConnectionStore.getState().setConnected(false);
      this.stopHeartbeat();
    });
  }

  disconnect(markManual = true): void {
    this.manuallyClosed = markManual;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socketTask) {
      this.socketTask.close({});
      this.socketTask = null;
    }

    useConnectionStore.getState().setConnected(false);
  }

  sendTransfer(targetDevice: string, action: TransferAction, payload: TransferPayload): void {
    this.send("client:transfer", {
      targetDevice,
      action,
      payload
    });
  }

  private send(event: string, payload: unknown): void {
    if (!this.socketTask) {
      return;
    }

    this.socketTask.send({
      data: JSON.stringify({ event, payload } satisfies WebSocketEnvelope)
    });
  }

  private handleMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") {
      return;
    }

    try {
      const message = JSON.parse(data) as WebSocketEnvelope;

      if (message.event === "server:stateUpdate") {
        const payload = message.payload as IncomingTransfer;
        useTransferStore.getState().receiveIncoming({
          ...payload,
          time: payload.time || Date.now()
        });
      }

      if (message.event === "server:deviceList") {
        const payload = message.payload as DeviceListPayload;
        useConnectionStore.getState().updateDevices(payload.devices ?? []);
      }

      if (message.event === "pong") {
        useConnectionStore.getState().setConnected(true);
      }
    } catch {
      // Ignore malformed server messages so the socket remains healthy.
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send("ping", {
        time: Date.now(),
        deviceId: this.params?.deviceId
      });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    const connection = useConnectionStore.getState();
    if (connection.retryCount >= MAX_RETRY_COUNT || !this.params) {
      useConnectionStore.getState().setReconnecting(false);
      return;
    }

    useConnectionStore.getState().setReconnecting(true);
    useConnectionStore.getState().addRetry();

    const delay = Math.min(1000 * 2 ** connection.retryCount, 15000);
    this.reconnectTimer = setTimeout(() => {
      if (this.params) {
        this.connect(this.params);
      }
    }, delay);
  }
}

export const websocketClient = new WebSocketClient();
