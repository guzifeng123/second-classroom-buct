import { Button, Text, View } from "@tarojs/components";
import type { AuthMode } from "../../../types/auth";
import type { EvaluationSyncStatus } from "../../../types/evaluation";
import type { ConnectionMode } from "../../../stores/useConnectionStore";
import type { TransferHistoryEntry } from "../../../types/transfer";
import { getRuntimeEnvironmentStatus } from "../../../utils/runtimeEnvironment";

interface EvaluationStatusBarProps {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  authMode: AuthMode;
  connectionMode: ConnectionMode;
  deviceName: string;
  transferHistory: TransferHistoryEntry[];
  syncStatus: EvaluationSyncStatus;
  lastSyncError: string | null;
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

function getSyncStatusText(syncStatus: EvaluationSyncStatus): string {
  if (syncStatus === "local-unsaved") {
    return "本地未保存";
  }

  if (syncStatus === "local-saved") {
    return "本地已保存";
  }

  if (syncStatus === "remote-syncing") {
    return "远端同步中";
  }

  if (syncStatus === "remote-synced") {
    return "远端已同步";
  }

  return "同步失败";
}

export default function EvaluationStatusBar({
  isConnected,
  isReconnecting,
  retryCount,
  authMode,
  connectionMode,
  deviceName,
  transferHistory,
  syncStatus,
  lastSyncError,
  onOpenNote,
  onOpenImages,
  onOpenHistory
}: EvaluationStatusBarProps) {
  const statusText = getStatusText(isConnected, isReconnecting, retryCount, authMode, connectionMode);
  const showHistory = transferHistory.length > 0;
  const environmentStatus = getRuntimeEnvironmentStatus();
  const syncStatusText = getSyncStatusText(syncStatus);

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
          <Text className={`evaluation-status__sync evaluation-status__sync--${syncStatus}`}>
            {syncStatusText}
          </Text>
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
      <Text
        className={`evaluation-status__hint ${
          environmentStatus.mode === "online" ? "evaluation-status__hint--success" : ""
        }`}
      >
        {environmentStatus.title}：{environmentStatus.apiLabel} · {environmentStatus.wsLabel}
      </Text>
      {syncStatus === "sync-failed" && lastSyncError ? (
        <Text className="evaluation-status__hint evaluation-status__hint--danger">同步失败：{lastSyncError}</Text>
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
