import { ApiError, hasApiBaseUrl, request } from "./api";
import type {
  EvaluationRecordMap,
  EvaluationSnapshot,
  EvaluationSubmissionRequest,
  EvaluationSubmissionResponse
} from "../types/evaluation";
import { normalizeEvaluationSnapshot } from "../utils/evaluationDraft";
import { recordErrorLog, recordKeyAction } from "../utils/monitoring";

export async function fetchEvaluationSnapshot(userId: string): Promise<EvaluationSnapshot | null> {
  if (!hasApiBaseUrl) {
    return null;
  }

  const snapshot = await request<EvaluationSnapshot>({
    url: `/snapshot/${encodeURIComponent(userId)}`
  });

  return normalizeEvaluationSnapshot(snapshot, "remote");
}

export async function saveEvaluationDraftRemote(
  userId: string,
  snapshot: EvaluationSnapshot
): Promise<EvaluationSnapshot> {
  if (!hasApiBaseUrl) {
    recordKeyAction("evaluation_draft_remote_save", "blocked", { reason: "missing_api_base_url" });
    throw new ApiError("未配置后端地址，已仅保存到本机");
  }

  recordKeyAction("evaluation_draft_remote_save", "attempt", { hasUserId: Boolean(userId) });

  let saved: EvaluationSnapshot;
  try {
    saved = await request<EvaluationSnapshot, EvaluationSnapshot>({
      url: `/evaluation-drafts/${encodeURIComponent(userId)}`,
      method: "PUT",
      data: {
        records: snapshot.records,
        selectedItemIds: snapshot.selectedItemIds,
        savedAt: snapshot.savedAt,
        draftVersion: snapshot.draftVersion
      }
    });
  } catch (error) {
    recordKeyAction("evaluation_draft_remote_save", "failed", { hasUserId: Boolean(userId) });
    recordErrorLog("evaluation_draft_remote_save", error, { hasUserId: Boolean(userId) });
    throw error;
  }

  recordKeyAction("evaluation_draft_remote_save", "success", { hasUserId: Boolean(userId) });
  return normalizeEvaluationSnapshot(saved, "remote");
}

export async function submitEvaluation(records: EvaluationRecordMap): Promise<EvaluationSubmissionResponse> {
  if (!hasApiBaseUrl) {
    recordKeyAction("evaluation_submit", "blocked", { reason: "missing_api_base_url" });
    throw new ApiError("未配置后端地址，离线模式不能提交");
  }

  recordKeyAction("evaluation_submit", "attempt");

  try {
    const response = await request<EvaluationSubmissionResponse, EvaluationSubmissionRequest>({
      url: "/evaluation-submissions",
      method: "POST",
      data: { records }
    });
    recordKeyAction("evaluation_submit", "success");
    return response;
  } catch (error) {
    recordKeyAction("evaluation_submit", "failed");
    recordErrorLog("evaluation_submit", error);
    throw error;
  }
}
