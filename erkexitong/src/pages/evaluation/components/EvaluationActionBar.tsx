import { Text, View } from "@tarojs/components";
import { ActionDock, FeedbackButton } from "../../../components/ui";

interface EvaluationActionBarProps {
  draftSavedAt: number | null;
  syncError?: string | null;
  materialCount: number;
  canSubmit: boolean;
  hasIncomingTransfer: boolean;
  onSubmit: () => void;
  onSave: () => void;
  onReset: () => void;
  onPreview: () => void;
  onApplyTransfer: () => void;
}

export default function EvaluationActionBar({
  draftSavedAt,
  syncError,
  materialCount,
  canSubmit,
  hasIncomingTransfer,
  onSubmit,
  onSave,
  onReset,
  onPreview,
  onApplyTransfer
}: EvaluationActionBarProps) {
  return (
    <View className="evaluation-actions">
      {hasIncomingTransfer ? (
        <View className="evaluation-actions__transfer-card">
          <View className="evaluation-actions__transfer-copy">
            <Text className="evaluation-actions__transfer-title">有一份跨端流转内容待应用</Text>
            <Text className="evaluation-actions__transfer-sub">确认后会合并到当前填写区。</Text>
          </View>
          <FeedbackButton
            className="evaluation-actions__transfer-button"
            loadingText="应用中"
            successText="已应用"
            onClick={onApplyTransfer}
          >
            应用流转
          </FeedbackButton>
        </View>
      ) : null}
      <ActionDock
        meta={
          <>
            <Text>
              {syncError
                ? `本地暂存 ${new Date(draftSavedAt ?? Date.now()).toLocaleTimeString()} · 远端未同步`
                : draftSavedAt
                  ? `暂存 ${new Date(draftSavedAt).toLocaleTimeString()}`
                  : "尚未暂存"}
            </Text>
            <Text>{materialCount} 条材料</Text>
          </>
        }
        primary={
          <FeedbackButton
            className="evaluation-actions__primary"
            loadingText={canSubmit ? "提交中" : "暂存中"}
            onClick={onSubmit}
          >
            {canSubmit ? "提交全部" : "本地暂存"}
          </FeedbackButton>
        }
        secondary={
          <>
            <FeedbackButton className="evaluation-actions__secondary" loadingText="打开中" onClick={onPreview}>
              预览
            </FeedbackButton>
            <FeedbackButton
              className="evaluation-actions__secondary"
              loadingText="保存中"
              successText="已保存"
              onClick={onSave}
            >
              临时保存
            </FeedbackButton>
          </>
        }
        danger={
          <FeedbackButton className="evaluation-actions__danger" loadingText="清空中" onClick={onReset}>
            清空
          </FeedbackButton>
        }
      />
    </View>
  );
}
