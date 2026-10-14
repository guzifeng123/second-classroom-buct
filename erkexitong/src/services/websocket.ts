import Taro from "@tarojs/taro";
import { useConnectionStore } from "../stores/useConnectionStore";
import { useTransferStore } from "../stores/useTransferStore";
import type {
  IncomingTransfer,
  TransferAckPayload,
  TransferAction,
  TransferPayload,
  WebSocketDevice,
  WebSocketEnvelope
} from "../types/transfer";
import { normalizeTransferAckPayload } from "../utils/transferDelivery";
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
const TRANSFER_ACK_TIMEOUT = 10000;

export class WebSocketClient {
  private socketTask: Taro.SocketTask | null = null;
  private params: ConnectParams | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private transferAckTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private manuallyClosed = false;

  constructor(private readonly transferAckTimeout = TRANSFER_ACK_TIMEOUT) {}

  connect(params: ConnectParams): void {
    this.disconnect(true);

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
      this.failPendingTransferAcks("连接已断开，未收到投递确认");
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    });

    socketTask.onError(() => {
      useConnectionStore.getState().setConnected(false);
      this.stopHeartbeat();
      this.failPendingTransferAcks("连接异常，未收到投递确认");
    });
  }

  disconnect(markManual = true): void {
    this.manuallyClosed = markManual;
    this.stopHeartbeat();
    this.failPendingTransferAcks(markManual ? "连接已关闭，未收到投递确认" : "连接重置，未收到投递确认");

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

  sendTransfer(
    messageId: string,
    targetDevice: string,
    action: TransferAction,
    payload: TransferPayload,
    sentAt: number
  ): boolean {
    const sent = this.send("client:transfer", {
      messageId,
      sentAt,
      targetDevice,
      action,
      payload
    });

    if (sent) {
      this.trackTransferAck(messageId);
    }

    return sent;
  }

  private send(event: string, payload: unknown): boolean {
    if (!this.socketTask) {
      return false;
    }

    try {
      this.socketTask.send({
        data: JSON.stringify({ event, payload } satisfies WebSocketEnvelope)
      });
      return true;
    } catch {
      return false;
    }
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

        if (payload.messageId) {
          this.send("client:transferAck", {
            messageId: payload.messageId,
            status: "delivered",
            receivedAt: Date.now(),
            deviceId: this.params?.deviceId
          } satisfies TransferAckPayload & { receivedAt: number; deviceId?: string });
        }
      }

      if (message.event === "server:transferAck") {
        const acknowledgement = normalizeTransferAckPayload(message.payload);

        if (acknowledgement) {
          this.clearTransferAckTimer(acknowledgement.messageId);
          useTransferStore.getState().updateDelivery(acknowledgement.messageId, acknowledgement.status, {
            serverTime: acknowledgement.serverTime,
            error: acknowledgement.error
          });
        }
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

  private trackTransferAck(messageId: string): void {
    this.clearTransferAckTimer(messageId);
    const timer = setTimeout(() => {
      this.transferAckTimers.delete(messageId);
      useTransferStore.getState().updateDelivery(messageId, "failed", {
        error: "服务端确认超时，请重试"
      });
    }, this.transferAckTimeout);
    this.transferAckTimers.set(messageId, timer);
  }

  private clearTransferAckTimer(messageId: string): void {
    const timer = this.transferAckTimers.get(messageId);

    if (timer) {
      clearTimeout(timer);
      this.transferAckTimers.delete(messageId);
    }
  }

  private failPendingTransferAcks(error: string): void {
    for (const [messageId, timer] of this.transferAckTimers) {
      clearTimeout(timer);
      useTransferStore.getState().updateDelivery(messageId, "failed", { error });
    }
    this.transferAckTimers.clear();
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
