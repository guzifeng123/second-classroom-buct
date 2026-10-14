const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

async function run() {
  const deliveryUtils = loadTsModule(path.join(projectRoot, "src", "utils", "transferDelivery.ts"));
  const validAck = deliveryUtils.normalizeTransferAckPayload({
    messageId: "transfer-1",
    status: "delivered",
    serverTime: 123
  });

  assertEqual(validAck.messageId, "transfer-1", "ACK 应保留消息 ID");
  assertEqual(validAck.status, "delivered", "ACK 应保留送达状态");
  assertEqual(validAck.serverTime, 123, "ACK 应保留服务端时间");
  assertEqual(deliveryUtils.normalizeTransferAckPayload({ status: "delivered" }), null, "缺少消息 ID 的 ACK 应被拒绝");
  assertEqual(deliveryUtils.getTransferDeliveryLabel("pending", 2), "重试待确认 · 2 次", "重试状态文案应包含次数");
  const selectableDevices = deliveryUtils.getSelectableTransferDevices([
    { deviceId: "broadcast", deviceName: "我的其他设备", online: true },
    { deviceId: "web-lab", deviceName: "实验室 Web 端", online: true },
    { deviceId: "phone", deviceName: "Android 手机端", online: false }
  ]);
  assertEqual(selectableDevices.length, 1, "设备选择列表应排除广播占位和离线设备");
  assertEqual(selectableDevices[0].deviceId, "web-lab", "设备选择列表应保留真实在线设备");

  const transferModule = loadTsModule(path.join(projectRoot, "src", "stores", "useTransferStore.ts"));
  const transferStore = transferModule.useTransferStore;
  transferStore.setState({ transferHistory: [], incomingTransfer: null, editingItem: null });
  transferStore.getState().addHistory({
    messageId: "store-message",
    direction: "sent",
    time: 1,
    action: "EDIT_ITEM",
    deviceName: "实验室 Web 端",
    summary: "证明材料",
    status: "pending",
    targetDevice: "web-lab",
    payload: {
      dimensionKey: "moral",
      sectionKey: "base",
      itemId: "moral-activity",
      recordId: "record-1",
      text: "证明材料",
      images: []
    },
    attempts: 1
  });
  transferStore.getState().updateDelivery("store-message", "failed", { error: "确认超时" });
  assertEqual(transferStore.getState().transferHistory[0].status, "failed", "历史记录应更新为失败");
  assertEqual(transferStore.getState().transferHistory[0].error, "确认超时", "历史记录应保留失败原因");
  transferStore.getState().markRetrying("store-message", 2);
  assertEqual(transferStore.getState().transferHistory[0].status, "pending", "重试后应恢复等待确认");
  assertEqual(transferStore.getState().transferHistory[0].attempts, 2, "重试后应增加尝试次数");

  const sentFrames = [];
  const deliveryUpdates = [];
  const receivedTransfers = [];
  const socket = {
    openHandler: null,
    messageHandler: null,
    closeHandler: null,
    errorHandler: null,
    onOpen(handler) {
      this.openHandler = handler;
    },
    onMessage(handler) {
      this.messageHandler = handler;
    },
    onClose(handler) {
      this.closeHandler = handler;
    },
    onError(handler) {
      this.errorHandler = handler;
    },
    send({ data }) {
      sentFrames.push(JSON.parse(data));
    },
    close() {}
  };
  const connectionState = {
    retryCount: 0,
    setMode() {},
    setConnected() {},
    setReconnecting() {},
    resetRetry() {},
    addRetry() {},
    updateDevices() {}
  };
  const transferState = {
    receiveIncoming(transfer) {
      receivedTransfers.push(transfer);
    },
    updateDelivery(messageId, status, details) {
      deliveryUpdates.push({ messageId, status, details });
    }
  };
  const websocketModule = loadTsModule(path.join(projectRoot, "src", "services", "websocket.ts"), {
    mocks: {
      "@tarojs/taro": {
        connectSocket: async () => socket
      },
      "../stores/useConnectionStore": {
        useConnectionStore: { getState: () => connectionState }
      },
      "../stores/useTransferStore": {
        useTransferStore: { getState: () => transferState }
      },
      "./api": {
        WS_BASE_URL: "wss://example.test/ws",
        hasWsBaseUrl: true
      }
    }
  });
  const client = new websocketModule.WebSocketClient(5);
  client.connect({ token: "token", userId: "student-1", deviceId: "device-1", deviceName: "H5" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  socket.openHandler();

  const payload = {
    dimensionKey: "moral",
    sectionKey: "base",
    itemId: "moral-activity",
    recordId: "record-1",
    text: "证明材料",
    images: []
  };
  assertEqual(client.sendTransfer("message-ack", "web-lab", "EDIT_ITEM", payload, 10), true, "连接后应可发送流转");
  const transferFrame = sentFrames.find((frame) => frame.event === "client:transfer");
  assertEqual(transferFrame.payload.messageId, "message-ack", "流转帧必须携带消息 ID");
  assertEqual(transferFrame.payload.sentAt, 10, "流转帧必须携带客户端发送时间");

  socket.messageHandler({
    data: JSON.stringify({
      event: "server:transferAck",
      payload: { messageId: "message-ack", status: "delivered", serverTime: 20 }
    })
  });
  assert(
    deliveryUpdates.some((update) => update.messageId === "message-ack" && update.status === "delivered"),
    "服务端 ACK 应更新历史送达状态"
  );

  socket.messageHandler({
    data: JSON.stringify({
      event: "server:stateUpdate",
      payload: {
        messageId: "incoming-1",
        targetDevice: "device-1",
        fromDevice: "实验室 Web 端",
        time: 30,
        action: "EDIT_ITEM",
        payload
      }
    })
  });
  assertEqual(receivedTransfers[0].messageId, "incoming-1", "接收端应保留流转消息 ID");
  assert(
    sentFrames.some(
      (frame) => frame.event === "client:transferAck" && frame.payload.messageId === "incoming-1"
    ),
    "接收端收到流转后应回传 ACK"
  );

  client.sendTransfer("message-timeout", "web-lab", "EDIT_ITEM", payload, 40);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert(
    deliveryUpdates.some((update) => update.messageId === "message-timeout" && update.status === "failed"),
    "ACK 超时应把历史标记为失败"
  );
  client.disconnect();

  console.log("WebSocket 流转 ACK 与重试状态测试通过。");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
