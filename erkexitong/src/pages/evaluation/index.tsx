import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tarojs/taro";
import { View } from "@tarojs/components";
import { hasApiBaseUrl } from "../../services/api";
import { initTransferSync } from "../../services/transferService";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useTransferStore } from "../../stores/useTransferStore";
import { useUserStore } from "../../stores/useUserStore";
import { SegmentTabs } from "../../components/ui";
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
import "./index.scss";

type EvaluationMode = "admin" | "fill" | "showcase";

export default function EvaluationPage() {
  const router = useRouter();
  const submitFromPreviewRef = useRef(false);
  const [mode, setMode] = useState<EvaluationMode>("fill");
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
    draftSavedAt,
    hydrated,
    hydrateDraft,
    lastSyncError,
    totalScore,
    validationIssues,
    materialCount,
    dimensionSummaries
  } = useEvaluationPageData();
  const {
    handleSave,
    handleSubmit,
    handleReset,
    handleGoLogin,
    handleOpenNote,
    handleOpenImages,
    handleOpenPreview,
    handleOpenHistory,
    handleApplyIncomingTransfer
  } = useEvaluationActions();

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

  if (!isLoggedIn) {
    return <EvaluationGate onGoLogin={handleGoLogin} />;
  }

  const selectedItemCount = dimensionSummaries.reduce((sum, dimension) => sum + dimension.selectedCount, 0);

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
            onOpenNote={handleOpenNote}
            onOpenImages={handleOpenImages}
            onOpenHistory={handleOpenHistory}
          />
        </View>
        {mode === "fill" ? (
          <EvaluationHero userId={userId} totalScore={totalScore} />
        ) : null}
        {mode === "fill" ? (
          <EvaluationWorkspace
            materialCount={materialCount}
            missingRequiredCount={validationIssues.length}
            selectedItemIds={selectedItemIds}
            dimensionSummaries={dimensionSummaries}
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
          draftSavedAt={draftSavedAt}
          syncError={lastSyncError}
          materialCount={materialCount}
          canSubmit={hasApiBaseUrl}
          hasIncomingTransfer={hasIncomingTransfer}
          onSubmit={handleSubmit}
          onSave={handleSave}
          onReset={handleReset}
          onPreview={handleOpenPreview}
          onApplyTransfer={handleApplyIncomingTransfer}
        />
      ) : null}
    </View>
  );
}
