import { ApiError, hasApiBaseUrl, request } from "./api";
import type {
  EvaluationRecordMap,
  EvaluationSnapshot,
  EvaluationSubmissionRequest,
  EvaluationSubmissionResponse
} from "../types/evaluation";

export async function fetchEvaluationSnapshot(userId: string): Promise<EvaluationSnapshot | null> {
  if (!hasApiBaseUrl) {
    return null;
  }

  const snapshot = await request<EvaluationSnapshot>({
    url: `/snapshot/${encodeURIComponent(userId)}`
  });

  return {
    ...snapshot,
    source: "remote"
  };
}

export async function saveEvaluationDraftRemote(
  userId: string,
  snapshot: EvaluationSnapshot
): Promise<EvaluationSnapshot> {
  if (!hasApiBaseUrl) {
    throw new ApiError("未配置后端地址，已仅保存到本机");
  }

  const saved = await request<EvaluationSnapshot, EvaluationSnapshot>({
    url: `/evaluation-drafts/${encodeURIComponent(userId)}`,
    method: "PUT",
    data: {
      records: snapshot.records,
      selectedItemIds: snapshot.selectedItemIds,
      savedAt: snapshot.savedAt
    }
  });

  return {
    ...saved,
    source: "remote"
  };
}

export async function submitEvaluation(records: EvaluationRecordMap): Promise<EvaluationSubmissionResponse> {
  if (!hasApiBaseUrl) {
    throw new ApiError("未配置后端地址，离线模式不能提交");
  }

  return request<EvaluationSubmissionResponse, EvaluationSubmissionRequest>({
    url: "/evaluation-submissions",
    method: "POST",
    data: { records }
  });
}
