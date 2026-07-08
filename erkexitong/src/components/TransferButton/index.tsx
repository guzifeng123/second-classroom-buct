import Taro from "@tarojs/taro";
import { Button } from "@tarojs/components";
import { hasWsBaseUrl } from "../../services/api";
import { sendTransferTo } from "../../services/transferService";
import { useConnectionStore } from "../../stores/useConnectionStore";
import type { EditingItemPayload } from "../../types/transfer";
import "./index.scss";

interface TransferButtonProps {
  payload: EditingItemPayload;
  action?: "EDIT_ITEM";
  disabled?: boolean;
  variant?: "default" | "compact";
}

export default function TransferButton({
  payload,
  action = "EDIT_ITEM",
  disabled = false,
  variant = "default"
}: TransferButtonProps) {
  const otherDevices = useConnectionStore((state) => state.otherDevices);
  const isConnected = useConnectionStore((state) => state.isConnected);
  const mode = useConnectionStore((state) => state.mode);
  const isOfflineDemo = mode === "offline-demo" || !hasWsBaseUrl;
  const onlineDevices = otherDevices.filter((device) => device.online);
  const canSend = isConnected || isOfflineDemo;

  const handleTransfer = async () => {
    if (disabled) {
      return;
    }

    if (!canSend) {
      await Taro.showToast({
        title: "离线时不能流转",
        icon: "none"
      });
      return;
    }

    const itemList = ["我的其他设备", ...onlineDevices.map((device) => device.deviceName)];

    try {
      const result = await Taro.showActionSheet({ itemList });
      const targetDevice = result.tapIndex === 0 ? "broadcast" : onlineDevices[result.tapIndex - 1]?.deviceId;

      await sendTransferTo(targetDevice || "broadcast", action, payload);
      await Taro.showToast({
        title: isOfflineDemo ? "已记录演示流转" : "内容已发送",
        icon: "success"
      });
    } catch {
      if (!isOfflineDemo) {
        return;
      }

      await sendTransferTo("broadcast", action, payload);
      await Taro.showToast({
        title: "已记录演示流转",
        icon: "success"
      });
    }
  };

  return (
    <Button
      className={`transfer-button transfer-button--${variant} ${canSend ? "transfer-button--online" : ""}`}
      disabled={disabled || !canSend}
      onClick={handleTransfer}
    >
      流转
    </Button>
  );
}
