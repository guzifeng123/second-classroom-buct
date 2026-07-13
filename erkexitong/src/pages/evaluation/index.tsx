import { useEffect, useRef, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { View } from "@tarojs/components";
import { fetchSubmissionRecords } from "../../services/submissionService";
import { initTransferSync } from "../../services/transferService";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useTransferStore } from "../../stores/useTransferStore";
import { useUserStore } from "../../stores/useUserStore";
import { FeedbackButton, SegmentTabs, StatusBanner } from "../../components/ui";
import type { SubmissionRecord } from "../../types/submission";
import EvaluationActionBar from "./components/EvaluationActionBar";
import EvaluationAdminDashboard from "./components/EvaluationAdminDashboard";
import EvaluationGate from "./components/EvaluationGate";
import EvaluationHero from "./components/EvaluationHero";
import EvaluationShowcaseDashboard from "./components/EvaluationShowcaseDashboard";
import EvaluationStatusBar from "./components/EvaluationStatusBar";
import EvaluationWorkspace from "./components/EvaluationWorkspace";
import { useEvaluationActions } from "./hooks/useEvaluationActions";
import { useEvaluationPageData } from "./hooks/useEvaluationPageData";
import { useEvaluationTransferPrompt } from "./hooks/useEvaluationTransferPrompt";
import { buildIssueFocusUrl } from "../../utils/evaluationIssueFocus";
import "./index.scss";

type EvaluationMode = "admin" | "fill" | "showcase";
type FocusField = "text" | "number" | "upload";

function parseFocusField(value?: string): FocusField | undefined {
  if (value === "text" || value === "number" || value === "upload") {
    return value;
  }

  return undefined;
}

function getReviewMessage(record: SubmissionRecord): string {
  return record.returnReason ?? record.reviewComment ?? "审核退回，请根据问题队列补充材料。";
}

function buildReturnedIssueFocusUrl(record: SubmissionRecord): string | null {
  const issue = record.validationIssues[0];

  if (!issue) {
    return null;
  }

  return buildIssueFocusUrl(issue);
}

export default function EvaluationPage() {
  const router = useRouter();
  const submitFromPreviewRef = useRef(false);
  const [mode, setMode] = useState<EvaluationMode>("fill");
  const [latestReturnedRecord, setLatestReturnedRecord] = useState<SubmissionRecord | null>(null);
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const deviceName = useUserStore((state) => state.deviceName);
  const authMode = useUserStore((state) => state.authMode);
  const isConnected = useConnectionStore((state) => state.isConnected);
  const isReconnecting = useConnectionStore((state) => state.isReconnecting);
  const retryCount = useConnectionStore((state) => state.retryCount);
  const connectionMode = useConnectionStore((state) => state.mode);
  const transferHistory = useTransferStore((state) => state.transferHistory);
  const hasIncomingTransfer = useTransferStore((state) => Boolean(state.incomingTransfer));
  const {
    records,
    selectedItemIds,
    hydrated,
    hydrateDraft,
    syncStatus,
    lastSyncError,
    totalScore,
    validationIssues,
    materialCount,
    dimensionSummaries
  } = useEvaluationPageData();
  const {
    handleSave,
    handleSubmit,
    handleGoLogin,
    handleOpenNote,
    handleOpenImages,
    handleOpenPreview,
    handleOpenHistory,
    handleApplyIncomingTransfer
  } = useEvaluationActions();
  const focusDimension = router.params.focusDimension;
  const focusItem = router.params.focusItem;
  const focusRecord = router.params.focusRecord;
  const focusUpload = router.params.focusUpload === "1";
  const focusField = parseFocusField(router.params.focusField);
  const parsedFocusImageIndex = Number(router.params.focusImageIndex);
  const focusImageIndex =
    Number.isInteger(parsedFocusImageIndex) && parsedFocusImageIndex >= 0 ? parsedFocusImageIndex : undefined;

  useEvaluationTransferPrompt();

  useEffect(() => {
    if (isLoggedIn) {
      initTransferSync();
    }
  }, [isLoggedIn, userId, deviceName]);

  useEffect(() => {
    if (!hydrated) {
      void hydrateDraft(userId);
    }
  }, [hydrated, hydrateDraft, userId]);

  useEffect(() => {
    if (router.params.submit === "1" && isLoggedIn && hydrated && !submitFromPreviewRef.current) {
      submitFromPreviewRef.current = true;
      void handleSubmit();
    }
  }, [router.params.submit, isLoggedIn, hydrated, handleSubmit]);

  useEffect(() => {
    if (router.params.mode === "fill" || focusItem) {
      setMode("fill");
    }
  }, [focusItem, router.params.mode]);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setLatestReturnedRecord(null);
      return;
    }

    const loadLatestReturnedRecord = async () => {
      try {
        const result = await fetchSubmissionRecords(userId);
        const returnedRecord =
          result.data
            .filter((record) => record.reviewStatus === "returned")
            .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
        setLatestReturnedRecord(returnedRecord);
      } catch {
        setLatestReturnedRecord(null);
      }
    };

    void loadLatestReturnedRecord();
  }, [isLoggedIn, userId]);

  if (!isLoggedIn) {
    return <EvaluationGate onGoLogin={handleGoLogin} />;
  }

  const selectedItemCount = dimensionSummaries.reduce((sum, dimension) => sum + dimension.selectedCount, 0);
  const handlePreviewWithSave = async () => {
    await handleSave();
    await handleOpenPreview();
  };
  const returnedIssueFocusUrl = latestReturnedRecord ? buildReturnedIssueFocusUrl(latestReturnedRecord) : null;

  return (
    <View className={`page-shell evaluation-page evaluation-page--mode-${mode}`}>
      <View className="evaluation-shell">
        <View className="evaluation-topbar">
          <View className="evaluation-mode-bar">
            <SegmentTabs
              items={[
                { key: "admin", label: "后台", active: mode === "admin", onClick: () => setMode("admin") },
                { key: "fill", label: "填报", active: mode === "fill", onClick: () => setMode("fill") },
                { key: "showcase", label: "展示", active: mode === "showcase", onClick: () => setMode("showcase") }
              ]}
            />
          </View>
          <EvaluationStatusBar
            isConnected={isConnected}
            isReconnecting={isReconnecting}
            retryCount={retryCount}
            authMode={authMode}
            connectionMode={connectionMode}
            deviceName={deviceName}
            transferHistory={transferHistory}
            syncStatus={syncStatus}
            lastSyncError={lastSyncError}
            onOpenNote={handleOpenNote}
            onOpenImages={handleOpenImages}
            onOpenHistory={handleOpenHistory}
          />
        </View>
        {mode === "fill" ? (
          <EvaluationHero
            userId={userId}
            totalScore={totalScore}
            onSave={handleSave}
            onPreview={handlePreviewWithSave}
            onSubmit={handleSubmit}
          />
        ) : null}
        {mode === "fill" && latestReturnedRecord ? (
          <StatusBanner
            tone="warning"
            title="最近一次提交被退回补充"
            description={getReviewMessage(latestReturnedRecord)}
            action={
              <View className="evaluation-returned__actions">
                {returnedIssueFocusUrl ? (
                  <FeedbackButton
                    className="evaluation-returned__locate"
                    loadingText="定位中"
                    onClick={() => Taro.redirectTo({ url: returnedIssueFocusUrl })}
                  >
                    定位补充
                  </FeedbackButton>
                ) : null}
                <FeedbackButton
                  className="evaluation-returned__history"
                  loadingText="打开中"
                  onClick={handleOpenHistory}
                >
                  查看记录
                </FeedbackButton>
              </View>
            }
          />
        ) : null}
        {mode === "fill" ? (
          <EvaluationWorkspace
            materialCount={materialCount}
            missingRequiredCount={validationIssues.length}
            selectedItemIds={selectedItemIds}
            dimensionSummaries={dimensionSummaries}
            focusDimensionKey={focusDimension}
            focusItemId={focusItem}
            focusRecordId={focusRecord}
            focusUpload={focusUpload}
            focusField={focusField}
            focusImageIndex={focusImageIndex}
          />
        ) : null}
        {mode === "admin" ? (
          <EvaluationAdminDashboard
            userId={userId}
            totalScore={totalScore}
            materialCount={materialCount}
            validationIssues={validationIssues}
            dimensionSummaries={dimensionSummaries}
            onShowFill={() => setMode("fill")}
            onShowShowcase={() => setMode("showcase")}
            onOpenHistory={handleOpenHistory}
          />
        ) : null}
        {mode === "showcase" ? (
          <EvaluationShowcaseDashboard
            userId={userId}
            totalScore={totalScore}
            materialCount={materialCount}
            selectedItemCount={selectedItemCount}
            records={records}
            validationIssues={validationIssues}
            dimensionSummaries={dimensionSummaries}
            onShowFill={() => setMode("fill")}
            onOpenPreview={handleOpenPreview}
            onOpenHistory={handleOpenHistory}
          />
        ) : null}
      </View>

      {mode === "fill" ? (
        <EvaluationActionBar
          hasIncomingTransfer={hasIncomingTransfer}
          onApplyTransfer={handleApplyIncomingTransfer}
        />
      ) : null}
    </View>
  );
}
