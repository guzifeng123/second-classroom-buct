import { Button, Text, View } from "@tarojs/components";
import { FeedbackButton } from "../../../components/ui";
import type { AuthMode } from "../../../types/auth";
import type { EvaluationSyncStatus } from "../../../types/evaluation";
import type { ConnectionMode } from "../../../stores/useConnectionStore";
import type { TransferHistoryEntry } from "../../../types/transfer";
import {
  classifySyncError,
  getSyncErrorDisplay,
  getSyncStatusDisplay
} from "../../../utils/evaluationSyncStatus";
import { getRuntimeEnvironmentStatus } from "../../../utils/runtimeEnvironment";
import { formatTransferTime, getTransferDeliveryLabel } from "../../../utils/transferDelivery";

interface EvaluationStatusBarProps {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  authMode: AuthMode;
  connectionMode: ConnectionMode;
  deviceName: string;
  transferHistory: TransferHistoryEntry[];
  syncStatus: EvaluationSyncStatus;
  draftSavedAt: number | null;
  lastSyncError: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorStatusCode: number | null;
  onRetrySync: () => Promise<unknown>;
  onGoLogin: () => Promise<unknown>;
  onOpenNote: () => void;
  onOpenImages: () => void;
  onOpenHistory: () => void;
  onRetryTransfer: (messageId: string) => Promise<unknown>;
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
  syncStatus,
  draftSavedAt,
  lastSyncError,
  lastSyncErrorCode,
  lastSyncErrorStatusCode,
  onRetrySync,
  onGoLogin,
  onOpenNote,
  onOpenImages,
  onOpenHistory,
  onRetryTransfer
}: EvaluationStatusBarProps) {
  const statusText = getStatusText(isConnected, isReconnecting, retryCount, authMode, connectionMode);
  const showHistory = transferHistory.length > 0;
  const environmentStatus = getRuntimeEnvironmentStatus();
  const syncStatusDisplay = getSyncStatusDisplay(syncStatus, draftSavedAt);
  const syncErrorInput = {
    message: lastSyncError,
    code: lastSyncErrorCode,
    statusCode: lastSyncErrorStatusCode
  };
  const canReloginForSync = classifySyncError(syncErrorInput) === "permission";

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
            {syncStatusDisplay}
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
      {syncStatus === "sync-failed" ? (
        <View className="evaluation-status__sync-error">
          <Text className="evaluation-status__hint evaluation-status__hint--danger">
            {getSyncErrorDisplay(syncErrorInput)}
          </Text>
          {canReloginForSync ? (
            <FeedbackButton
              className="evaluation-status__retry"
              loadingText="跳转中"
              onClick={onGoLogin}
            >
              重新登录
            </FeedbackButton>
          ) : null}
          <FeedbackButton
            className="evaluation-status__retry"
            loadingText="同步中"
            successText="已同步"
            errorText="重试失败"
            onClick={onRetrySync}
          >
            重试同步
          </FeedbackButton>
        </View>
      ) : null}

      {showHistory ? (
        <View className="evaluation-transfer-history">
          <Text className="evaluation-transfer-history__label">最近流转</Text>
          {transferHistory.map((entry) => {
            const statusTime = formatTransferTime(entry.serverTime);
            return (
              <View
                className={`evaluation-transfer-history__item evaluation-transfer-history__item--${entry.status}`}
                key={entry.messageId}
              >
                <Text className="evaluation-transfer-history__copy">
                  {entry.direction === "sent" ? "发往" : "来自"} {entry.deviceName} · {entry.summary}
                </Text>
                <Text className="evaluation-transfer-history__status">
                  {getTransferDeliveryLabel(entry.status, entry.attempts)}
                  {statusTime ? ` · ${statusTime}` : ""}
                </Text>
                {entry.error ? <Text className="evaluation-transfer-history__error">{entry.error}</Text> : null}
                {entry.direction === "sent" && entry.status === "failed" ? (
                  <FeedbackButton
                    className="evaluation-transfer-history__retry"
                    loadingText="重试中"
                    successText="已重发"
                    errorText="重试失败"
                    onClick={() => onRetryTransfer(entry.messageId)}
                  >
                    重试
                  </FeedbackButton>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
