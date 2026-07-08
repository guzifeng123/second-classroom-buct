import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl } from "../../../services/api";
import { submitEvaluation } from "../../../services/evaluationService";
import { saveSubmissionRecord } from "../../../services/submissionService";
import { applyIncomingTransfer } from "../../../services/transferService";
import { uploadLocalProofImages } from "../../../services/upload";
import { useEvaluationStore } from "../../../stores/useEvaluationStore";
import { useUserStore } from "../../../stores/useUserStore";
import type { EvaluationValidationIssue } from "../../../types/evaluation";
import { openDetailRouteOnce } from "../../../utils/detailNavigation";
import { buildDimensionSummaries, countMaterials } from "../../../utils/evaluationSummary";

function issueSummary(issues: EvaluationValidationIssue[]): string {
  const visible = issues.slice(0, 4).map((issue) => issue.message);
  const restCount = issues.length - visible.length;

  return restCount > 0 ? `${visible.join("\n")}\n等 ${issues.length} 项问题` : visible.join("\n");
}

export function useEvaluationActions() {
  const userId = useUserStore((state) => state.userId);
  const saveDraft = useEvaluationStore((state) => state.saveDraft);
  const resetDraft = useEvaluationStore((state) => state.resetDraft);
  const getValidationIssues = useEvaluationStore((state) => state.getValidationIssues);

  const showValidationIssues = async (issues: EvaluationValidationIssue[]) => {
    await Taro.showModal({
      title: "提交前请完善材料",
      content: issueSummary(issues),
      showCancel: false
    });
  };

  const handleSave = async () => {
    try {
      const result = await saveDraft(userId);
      await Taro.showToast({
        title: result.remoteSaved ? "已同步保存" : "已本地暂存",
        icon: "success"
      });

      if (result.remoteError) {
        await Taro.showModal({
          title: "远端未同步",
          content: result.remoteError,
          showCancel: false
        });
      }
    } catch (error) {
      await Taro.showToast({
        title: getErrorMessage(error, "保存失败"),
        icon: "none"
      });
    }
  };

  const handleSubmit = async () => {
    const preUploadIssues = getValidationIssues().filter((issue) => issue.type !== "local_image");

    if (!hasApiBaseUrl) {
      await saveDraft(userId);
      await Taro.showModal({
        title: "已本地暂存",
        content:
          preUploadIssues.length > 0
            ? `当前仅完成本地暂存，真实提交需配置后端接口。\n\n提交前还需完善：\n${issueSummary(
                preUploadIssues
              )}`
            : "当前仅完成本地暂存，真实提交需配置后端接口。",
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

    try {
      const state = useEvaluationStore.getState();
      const uploadedRecords = await uploadLocalProofImages(state.records);
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
        totalScore: finalState.getTotalScore(),
        materialCount: countMaterials(finalState.records),
        issueCount: finalIssuesForSummary.length,
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
      await Taro.showModal({
        title: "提交失败",
        content: getErrorMessage(error, "请稍后重试"),
        showCancel: false
      });
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

  return {
    handleSave,
    handleSubmit,
    handleReset,
    handleGoLogin,
    handleOpenNote,
    handleOpenImages,
    handleOpenPreview,
    handleOpenHistory,
    handleApplyIncomingTransfer: applyIncomingTransfer
  };
}
