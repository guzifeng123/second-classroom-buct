import Taro from "@tarojs/taro";
import { EVALUATION_RULE_VERSION, evaluationConfig, findEvaluationItem } from "../../../data/evaluationConfig";
import { hasApiBaseUrl } from "../../../services/api";
import { submitEvaluation } from "../../../services/evaluationService";
import { saveSubmissionRecord } from "../../../services/submissionService";
import { applyIncomingTransfer, retryTransfer } from "../../../services/transferService";
import { countLocalProofImages, uploadLocalProofImages, type UploadProgressSnapshot } from "../../../services/upload";
import { useEvaluationStore } from "../../../stores/useEvaluationStore";
import { useUserStore } from "../../../stores/useUserStore";
import type { EvaluationValidationIssue } from "../../../types/evaluation";
import { openDetailRouteOnce } from "../../../utils/detailNavigation";
import { buildIssueFocusUrl } from "../../../utils/evaluationIssueFocus";
import { buildDimensionSummaries, countMaterials } from "../../../utils/evaluationSummary";
import { getSyncErrorLabel } from "../../../utils/evaluationSyncStatus";
import {
  buildOfflineSubmitMessage,
  buildRemoteDraftFailureMessage,
  buildSaveFailureMessage,
  buildSubmitFailureMessage,
  feedbackTitles
} from "../../../utils/feedbackMessages";

function issueSummary(issues: EvaluationValidationIssue[]): string {
  const visible = issues.slice(0, 4).map((issue) => issue.message);
  const restCount = issues.length - visible.length;

  return restCount > 0 ? `${visible.join("\n")}\n等 ${issues.length} 项问题` : visible.join("\n");
}

function updateSubmitLoadingTitle(title: string, previousTitle: { current: string }) {
  if (previousTitle.current === title) {
    return;
  }

  previousTitle.current = title;
  void Taro.showLoading({ title });
}

function findDimensionTitle(snapshot: UploadProgressSnapshot): string {
  return (
    evaluationConfig.find((dimension) => dimension.key === snapshot.dimensionKey)?.title ??
    snapshot.dimensionKey ??
    "未知维度"
  );
}

function buildUploadProgressLocation(snapshot: UploadProgressSnapshot | null): string {
  if (!snapshot) {
    return "";
  }

  const dimensionTitle = findDimensionTitle(snapshot);
  const itemTitle = snapshot.itemId ? findEvaluationItem(snapshot.itemId)?.title ?? snapshot.itemId : "未知条目";
  const imageIndex = typeof snapshot.imageIndex === "number" ? snapshot.imageIndex + 1 : snapshot.fileIndex + 1;

  return `失败位置：${dimensionTitle} / ${itemTitle} / 第 ${imageIndex} 张证明图片`;
}

function buildUploadProgressFocusUrl(snapshot: UploadProgressSnapshot | null): string {
  if (!snapshot?.dimensionKey || !snapshot.itemId) {
    return "";
  }

  const params = new URLSearchParams({
    mode: "fill",
    focusDimension: snapshot.dimensionKey,
    focusItem: snapshot.itemId,
    focusUpload: "1"
  });

  if (snapshot.sectionKey) {
    params.set("focusSection", snapshot.sectionKey);
  }

  if (snapshot.recordId) {
    params.set("focusRecord", snapshot.recordId);
  }

  if (typeof snapshot.imageIndex === "number") {
    params.set("focusImageIndex", String(snapshot.imageIndex));
  }

  return `/pages/evaluation/index?${params.toString()}`;
}

export function useEvaluationActions() {
  const userId = useUserStore((state) => state.userId);
  const saveDraft = useEvaluationStore((state) => state.saveDraft);
  const resetDraft = useEvaluationStore((state) => state.resetDraft);
  const getValidationIssues = useEvaluationStore((state) => state.getValidationIssues);

  const showValidationIssues = async (issues: EvaluationValidationIssue[]) => {
    const focusUrl = issues[0] ? buildIssueFocusUrl(issues[0]) : "";
    const result = await Taro.showModal({
      title: "提交前请完善材料",
      content: issueSummary(issues),
      showCancel: Boolean(focusUrl),
      cancelText: "关闭",
      confirmText: focusUrl ? "定位修改" : "知道了"
    });

    if (result.confirm && focusUrl) {
      await Taro.redirectTo({ url: focusUrl });
    }
  };

  const handleSave = async () => {
    try {
      const result = await saveDraft(hasApiBaseUrl ? userId : undefined);
      await Taro.showToast({
        title: result.remoteSaved ? feedbackTitles.draftRemoteSaved : feedbackTitles.draftLocalSaved,
        icon: "success"
      });

      if (result.remoteError) {
        await Taro.showModal({
          title: feedbackTitles.remoteDraftFailed,
          content: buildRemoteDraftFailureMessage(result.remoteError),
          showCancel: false
        });
      }
    } catch (error) {
      await Taro.showToast({
        title: buildSaveFailureMessage(error),
        icon: "none"
      });
    }
  };

  const handleRetrySync = async () => {
    if (!hasApiBaseUrl) {
      await Taro.showToast({
        title: "未配置远端服务",
        icon: "none"
      });
      throw new Error("未配置远端服务");
    }

    if (!userId) {
      await Taro.showToast({
        title: "登录状态无效",
        icon: "none"
      });
      throw new Error("登录状态无效");
    }

    try {
      const result = await saveDraft(userId);

      if (!result.remoteSaved) {
        await Taro.showToast({
          title: getSyncErrorLabel({
            message: result.remoteError,
            code: result.remoteErrorCode,
            statusCode: result.remoteErrorStatusCode
          }),
          icon: "none"
        });
        throw new Error(result.remoteError ?? "远端草稿保存失败");
      }

      await Taro.showToast({
        title: "远端同步成功",
        icon: "success"
      });
    } catch (error) {
      if (useEvaluationStore.getState().syncStatus !== "sync-failed") {
        await Taro.showToast({
          title: getSyncErrorLabel({
            message: error instanceof Error ? error.message : null,
            code:
              error && typeof error === "object" && "errorCode" in error && typeof error.errorCode === "string"
                ? error.errorCode
                : null,
            statusCode:
              error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number"
                ? error.statusCode
                : null
          }),
          icon: "none"
        });
      }
      throw error;
    }
  };

  const handleSubmit = async () => {
    const preUploadIssues = getValidationIssues().filter((issue) => issue.type !== "local_image");

    if (!hasApiBaseUrl) {
      await saveDraft();
      await Taro.showModal({
        title: feedbackTitles.offlineSubmitBlocked,
        content: buildOfflineSubmitMessage(preUploadIssues.length > 0 ? issueSummary(preUploadIssues) : undefined),
        showCancel: false
      });
      return;
    }

    if (preUploadIssues.length > 0) {
      await showValidationIssues(preUploadIssues);
      return;
    }

    await Taro.showLoading({
      title: "提交中"
    });

    let submitPhase: "uploading-local-images" | "submitting-records" = "uploading-local-images";
    let lastUploadProgress: UploadProgressSnapshot | null = null;

    try {
      const state = useEvaluationStore.getState();
      const localImageCount = countLocalProofImages(state.records);
      const loadingTitleRef = { current: "提交中" };
      const handleUploadProgress = (snapshot: UploadProgressSnapshot) => {
        lastUploadProgress = snapshot;
        const title = `上传证明 ${snapshot.fileIndex + 1}/${snapshot.fileCount}`;
        updateSubmitLoadingTitle(title, loadingTitleRef);
      };

      if (localImageCount > 0) {
        updateSubmitLoadingTitle(`上传证明 1/${localImageCount}`, loadingTitleRef);
      }

      const uploadedRecords = await uploadLocalProofImages(state.records, {
        onProgress: (snapshot) => {
          handleUploadProgress(snapshot);
        }
      });
      updateSubmitLoadingTitle("提交中", loadingTitleRef);
      submitPhase = "submitting-records";
      await state.applySnapshot({
        records: uploadedRecords,
        selectedItemIds: state.selectedItemIds,
        savedAt: Date.now(),
        source: "local"
      });

      const finalIssues = useEvaluationStore.getState().getValidationIssues();
      if (finalIssues.length > 0) {
        await Taro.hideLoading();
        await showValidationIssues(finalIssues);
        return;
      }

      const result = await submitEvaluation(useEvaluationStore.getState().records);
      const finalState = useEvaluationStore.getState();
      const finalIssuesForSummary = finalState.getValidationIssues();
      const createdAt = Date.now();
      const submissionId = result.submissionId || `local-${createdAt}`;

      await saveSubmissionRecord({
        submissionId,
        userId,
        createdAt,
        ruleVersion: EVALUATION_RULE_VERSION,
        totalScore: finalState.getTotalScore(),
        materialCount: countMaterials(finalState.records),
        issueCount: finalIssuesForSummary.length,
        reviewStatus: "pending",
        validationIssues: finalIssuesForSummary,
        records: finalState.records,
        selectedItemIds: finalState.selectedItemIds,
        dimensionSummaries: buildDimensionSummaries(
          finalState.records,
          finalState.selectedItemIds,
          finalIssuesForSummary
        )
      });
      await Taro.hideLoading();
      await Taro.redirectTo({
        url: `/pages/submission/result/index?submissionId=${encodeURIComponent(submissionId)}`
      });
    } catch (error) {
      await Taro.hideLoading();
      const uploadFailureLocation =
        submitPhase === "uploading-local-images" ? buildUploadProgressLocation(lastUploadProgress) : "";
      const uploadFailureFocusUrl =
        submitPhase === "uploading-local-images" ? buildUploadProgressFocusUrl(lastUploadProgress) : "";
      const modalResult = await Taro.showModal({
        title: feedbackTitles.submitFailed,
        content: buildSubmitFailureMessage(error, uploadFailureLocation),
        showCancel: Boolean(uploadFailureFocusUrl),
        cancelText: "关闭",
        confirmText: uploadFailureFocusUrl ? "定位修改" : "知道了"
      });

      if (modalResult.confirm && uploadFailureFocusUrl) {
        await Taro.redirectTo({ url: uploadFailureFocusUrl });
      }
    }
  };

  const handleReset = async () => {
    const result = await Taro.showModal({
      title: "清空草稿",
      content: "清空后将恢复为空白评定表",
      confirmText: "清空",
      cancelText: "取消"
    });
    if (result.confirm) {
      resetDraft();
      await Taro.showToast({
        title: "已清空草稿",
        icon: "success"
      });
    }
  };

  const handleGoLogin = async () => {
    await Taro.redirectTo({
      url: "/pages/login/index"
    });
  };

  const handleOpenNote = async () => {
    await openDetailRouteOnce("/pages/note/list/index");
  };

  const handleOpenImages = async () => {
    await openDetailRouteOnce("/pages/image/library/index");
  };

  const handleOpenPreview = async () => {
    await openDetailRouteOnce("/pages/evaluation/preview/index");
  };

  const handleOpenHistory = async () => {
    await openDetailRouteOnce("/pages/submission/history/index");
  };

  const handleRetryTransfer = async (messageId: string) => {
    try {
      await retryTransfer(messageId);
      await Taro.showToast({
        title: "已重发，等待确认",
        icon: "success"
      });
    } catch (error) {
      await Taro.showToast({
        title: error instanceof Error ? error.message : "重试发送失败",
        icon: "none"
      });
      throw error;
    }
  };

  return {
    handleSave,
    handleRetrySync,
    handleSubmit,
    handleReset,
    handleGoLogin,
    handleOpenNote,
    handleOpenImages,
    handleOpenPreview,
    handleOpenHistory,
    handleRetryTransfer,
    handleApplyIncomingTransfer: applyIncomingTransfer
  };
}
