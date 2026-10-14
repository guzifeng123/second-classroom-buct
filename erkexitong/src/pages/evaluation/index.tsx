import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { fetchSubmissionRecords } from "../../services/submissionService";
import { hasApiBaseUrl } from "../../services/api";
import { initTransferSync } from "../../services/transferService";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useTransferStore } from "../../stores/useTransferStore";
import { useEvaluationStore } from "../../stores/useEvaluationStore";
import { useUserStore } from "../../stores/useUserStore";
import { FeedbackButton, SegmentTabs, StatusBanner } from "../../components/ui";
import type { SubmissionRecord } from "../../types/submission";
import EvaluationActionBar from "./components/EvaluationActionBar";
import EvaluationGate from "./components/EvaluationGate";
import EvaluationHero from "./components/EvaluationHero";
import EvaluationStatusBar from "./components/EvaluationStatusBar";
import EvaluationWorkspace from "./components/EvaluationWorkspace";
import MobileEvaluationNavigator from "./components/MobileEvaluationNavigator";
import { useEvaluationActions } from "./hooks/useEvaluationActions";
import { useEvaluationPageData } from "./hooks/useEvaluationPageData";
import { useEvaluationTransferPrompt } from "./hooks/useEvaluationTransferPrompt";
import { canAccessAdminMode, getUserRoleLabel } from "../../utils/authPermissions";
import { buildIssueFocusUrl } from "../../utils/evaluationIssueFocus";
import "./index.scss";

const EvaluationAdminDashboard = lazy(() => import("./components/EvaluationAdminDashboard"));
const EvaluationShowcaseDashboard = lazy(() => import("./components/EvaluationShowcaseDashboard"));

type EvaluationMode = "admin" | "fill" | "showcase";
type FocusField = "text" | "number" | "upload";

function getIsDesktopViewport(): boolean {
  return process.env.TARO_ENV === "h5" && typeof window !== "undefined" && window.matchMedia("(min-width: 960px)").matches;
}

function useDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(getIsDesktopViewport);

  useEffect(() => {
    if (process.env.TARO_ENV !== "h5" || typeof window === "undefined") return undefined;
    const query = window.matchMedia("(min-width: 960px)");
    const handleChange = () => setIsDesktop(query.matches);
    handleChange();
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  return isDesktop;
}

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
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const isDesktopViewport = useDesktopViewport();
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const deviceName = useUserStore((state) => state.deviceName);
  const authMode = useUserStore((state) => state.authMode);
  const role = useUserStore((state) => state.role);
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
    draftSavedAt,
    syncStatus,
    lastSyncError,
    lastSyncErrorCode,
    lastSyncErrorStatusCode,
    totalScore,
    validationIssues,
    materialCount,
    dimensionSummaries
    , mobileDimensionKey
    , mobileItemId
    , lastEditedAt
  } = useEvaluationPageData();
  const {
    handleSave,
    handleRetrySync,
    handleSubmit,
    handleGoLogin,
    handleOpenNote,
    handleOpenImages,
    handleOpenPreview,
    handleOpenHistory,
    handleRetryTransfer,
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
  const canOpenAdminMode = canAccessAdminMode(role);
  const mobileCurrentKey = mobileDimensionKey ?? dimensionSummaries[0]?.key ?? "moral";
  const mobileCurrentIndex = dimensionSummaries.findIndex((dimension) => dimension.key === mobileCurrentKey);
  const pendingImageCount = useMemo(
    () => Object.values(records).reduce((sum, list) => sum + list.reduce((count, record) => count + record.images.filter((image) => !image.uploaded).length, 0), 0),
    [records]
  );
  const setMobilePosition = useEvaluationStore((state) => state.setMobilePosition);
  const saveDraftDebounced = useEvaluationStore((state) => state.saveDraftDebounced);

  useEffect(() => {
    if (lastEditedAt) {
      saveDraftDebounced(hasApiBaseUrl ? userId : undefined);
    }
  }, [lastEditedAt, saveDraftDebounced, userId]);

  useEffect(() => {
    return () => {
      if (useEvaluationStore.getState().syncStatus === "local-unsaved") {
        void useEvaluationStore.getState().saveDraft(hasApiBaseUrl ? userId : undefined);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (hydrated && !mobileDimensionKey && dimensionSummaries[0]) {
      setMobilePosition(dimensionSummaries[0].key, null);
    }
  }, [dimensionSummaries, hydrated, mobileDimensionKey, setMobilePosition]);

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
    if (focusDimension && dimensionSummaries.some((dimension) => dimension.key === focusDimension)) {
      setMobilePosition(focusDimension as typeof mobileCurrentKey, focusItem ?? null);
    }
  }, [dimensionSummaries, focusDimension, focusItem, router.params.mode, setMobilePosition]);

  useEffect(() => {
    if (mode === "admin" && !canOpenAdminMode) {
      setMode("fill");
      void Taro.showToast({
        title: "当前角色无后台权限",
        icon: "none"
      });
    }
  }, [canOpenAdminMode, mode]);

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
  const modeItems = [
    ...(canOpenAdminMode ? [{ key: "admin", label: "后台", active: mode === "admin", onClick: () => setMode("admin") }] : []),
    { key: "fill", label: "填报", active: mode === "fill", onClick: () => setMode("fill") },
    { key: "showcase", label: "展示", active: mode === "showcase", onClick: () => setMode("showcase") }
  ];

  return (
    <View className={`page-shell evaluation-page evaluation-page--mode-${mode}`}>
      <View className="evaluation-shell">
        <View className="evaluation-topbar">
          <View className="evaluation-mode-bar">
            <SegmentTabs items={modeItems} />
          </View>
          <View className={`evaluation-role-chip ${canOpenAdminMode ? "evaluation-role-chip--reviewer" : ""}`}>
            <Text className="evaluation-role-chip__label">角色</Text>
            <Text className="evaluation-role-chip__value">{getUserRoleLabel(role)}</Text>
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
            draftSavedAt={draftSavedAt}
            lastSyncError={lastSyncError}
            lastSyncErrorCode={lastSyncErrorCode}
            lastSyncErrorStatusCode={lastSyncErrorStatusCode}
            onRetrySync={handleRetrySync}
            onGoLogin={handleGoLogin}
            onOpenNote={handleOpenNote}
            onOpenImages={handleOpenImages}
            onOpenHistory={handleOpenHistory}
            onRetryTransfer={handleRetryTransfer}
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
          <View>
            {isDesktopViewport ? (
            <View className="evaluation-workspace-desktop">
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
            </View>
            ) : (
            <View className="evaluation-workspace-mobile evaluation-workspace-mobile--mounted">
            <MobileEvaluationNavigator
              dimensions={dimensionSummaries}
              currentKey={mobileCurrentKey}
              missingRequiredCount={validationIssues.length}
              pendingImageCount={pendingImageCount}
              onChange={(key) => setMobilePosition(key, null)}
              onSave={() => void handleSave()}
              onPrevious={() => {
                const previous = dimensionSummaries[mobileCurrentIndex - 1];
                if (previous) setMobilePosition(previous.key, null);
              }}
              onNext={() => {
                const next = dimensionSummaries[mobileCurrentIndex + 1];
                if (next) {
                  setMobilePosition(next.key, null);
                } else {
                  void handleOpenPreview();
                }
              }}
              isLast={mobileCurrentIndex === dimensionSummaries.length - 1}
              onlyIncomplete={onlyIncomplete}
              onToggleIncomplete={() => setOnlyIncomplete((value) => !value)}
            />
            <EvaluationWorkspace
              materialCount={materialCount}
              missingRequiredCount={validationIssues.length}
              selectedItemIds={selectedItemIds}
              dimensionSummaries={dimensionSummaries}
              mobileDimensionKey={mobileCurrentKey}
              mobileOnly
              onlyIncomplete={onlyIncomplete}
              validationIssues={validationIssues}
              focusDimensionKey={focusDimension}
              focusItemId={focusItem}
              focusRecordId={focusRecord}
              focusUpload={focusUpload}
              focusField={focusField}
              focusImageIndex={focusImageIndex}
            />
            </View>
            )}
          </View>
        ) : null}
        <Suspense fallback={null}>
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
        </Suspense>
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
