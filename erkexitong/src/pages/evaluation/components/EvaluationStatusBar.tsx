import { Button, Text, View } from "@tarojs/components";
import type { AuthMode } from "../../../types/auth";
import type { ConnectionMode } from "../../../stores/useConnectionStore";
import type { TransferHistoryEntry } from "../../../types/transfer";

interface EvaluationStatusBarProps {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  authMode: AuthMode;
  connectionMode: ConnectionMode;
  deviceName: string;
  transferHistory: TransferHistoryEntry[];
  onOpenNote: () => void;
  onOpenImages: () => void;
  onOpenHistory: () => void;
}

function getStatusText(
  isConnected: boolean,
  isReconnecting: boolean,
  retryCount: number,
  authMode: AuthMode,
  connectionMode: ConnectionMode
): string {
  if (connectionMode === "offline-demo" || authMode === "offline") {
    return "离线演示";
  }

  if (isConnected) {
    return "已连接";
  }

  return isReconnecting ? `重连中 ${retryCount}` : "离线草稿";
}

export default function EvaluationStatusBar({
  isConnected,
  isReconnecting,
  retryCount,
  authMode,
  connectionMode,
  deviceName,
  transferHistory,
  onOpenNote,
  onOpenImages,
  onOpenHistory
}: EvaluationStatusBarProps) {
  const statusText = getStatusText(isConnected, isReconnecting, retryCount, authMode, connectionMode);
  const showHistory = transferHistory.length > 0;

  return (
    <View className="evaluation-status-wrap">
      <View className="evaluation-status">
        <View className="evaluation-status__connection">
          <Text
            className={
              isConnected
                ? "evaluation-status__dot--on"
                : connectionMode === "offline-demo"
                  ? "evaluation-status__dot--demo"
                  : "evaluation-status__dot"
            }
          />
          <Text className="evaluation-status__text">{statusText}</Text>
          <Text className="evaluation-status__device">{deviceName}</Text>
        </View>
        <View className="evaluation-status__resources">
          <Text className="evaluation-status__resources-label">流转</Text>
          <Button className="evaluation-status__note" onClick={onOpenNote}>
            笔记库
          </Button>
          <Button className="evaluation-status__note" onClick={onOpenImages}>
            图片素材
          </Button>
          <Button className="evaluation-status__note" onClick={onOpenHistory}>
            提交记录
          </Button>
        </View>
      </View>

      {connectionMode === "offline-demo" ? (
        <Text className="evaluation-status__hint">离线演示仅记录流转动作，真实跨端同步需配置 WebSocket 后端。</Text>
      ) : null}

      {showHistory ? (
        <View className="evaluation-transfer-history">
          <Text className="evaluation-transfer-history__label">最近流转</Text>
          {transferHistory.map((entry) => (
            <Text className="evaluation-transfer-history__item" key={`${entry.time}-${entry.direction}`}>
              {entry.direction === "sent" ? "发往" : "来自"} {entry.deviceName} · {entry.summary}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
