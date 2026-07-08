import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { SubmissionDimensionSummary, SubmissionRecord } from "../types/submission";

const LOCAL_SUBMISSIONS_KEY = "erkexitong-submission-history";

interface SubmissionApiResponse {
  submissionId?: string;
  submission_id?: string;
  id?: string;
  userId?: string;
  user_id?: string;
  createdAt?: number;
  created_at?: string;
  totalScore?: number;
  total_score?: number;
  materialCount?: number;
  material_count?: number;
  issueCount?: number;
  issue_count?: number;
  dimensionSummaries?: SubmissionDimensionSummary[];
  dimension_summaries?: SubmissionDimensionSummary[];
}

type SubmissionListApiResponse = SubmissionApiResponse[] | { data?: SubmissionApiResponse[]; total?: number };

export interface SubmissionListResult {
  data: SubmissionRecord[];
  total: number;
  source: "local" | "remote";
  error?: string;
}

function parseTime(value?: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeRemoteSubmission(raw: SubmissionApiResponse): SubmissionRecord {
  return {
    submissionId: raw.submissionId ?? raw.submission_id ?? raw.id ?? "",
    userId: raw.userId ?? raw.user_id ?? "",
    createdAt: parseTime(raw.createdAt ?? raw.created_at),
    totalScore: raw.totalScore ?? raw.total_score ?? 0,
    materialCount: raw.materialCount ?? raw.material_count ?? 0,
    issueCount: raw.issueCount ?? raw.issue_count ?? 0,
    records: {},
    selectedItemIds: [],
    dimensionSummaries: raw.dimensionSummaries ?? raw.dimension_summaries ?? []
  };
}

function normalizeList(raw: SubmissionListApiResponse): SubmissionRecord[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeRemoteSubmission).filter((submission) => submission.submissionId);
}

async function readLocalSubmissions(): Promise<SubmissionRecord[]> {
  try {
    const result = await Taro.getStorage<SubmissionRecord[]>({ key: LOCAL_SUBMISSIONS_KEY });
    return Array.isArray(result.data) ? result.data : [];
  } catch {
    return [];
  }
}

async function writeLocalSubmissions(submissions: SubmissionRecord[]): Promise<void> {
  await Taro.setStorage({
    key: LOCAL_SUBMISSIONS_KEY,
    data: submissions
  });
}

export async function saveSubmissionRecord(record: SubmissionRecord): Promise<void> {
  const submissions = await readLocalSubmissions();
  const nextSubmissions = [record, ...submissions.filter((item) => item.submissionId !== record.submissionId)].sort(
    (left, right) => right.createdAt - left.createdAt
  );

  await writeLocalSubmissions(nextSubmissions);
}

export async function fetchSubmissionRecords(userId: string): Promise<SubmissionListResult> {
  if (hasApiBaseUrl) {
    try {
      const remoteRecords = normalizeList(
        await request<SubmissionListApiResponse>({
          url: `/evaluation-submissions?userId=${encodeURIComponent(userId)}`
        })
      );

      return {
        data: remoteRecords,
        total: remoteRecords.length,
        source: "remote"
      };
    } catch (error) {
      const localRecords = (await readLocalSubmissions()).filter((record) => record.userId === userId);

      return {
        data: localRecords,
        total: localRecords.length,
        source: "local",
        error: getErrorMessage(error, "提交记录读取失败")
      };
    }
  }

  const localRecords = (await readLocalSubmissions()).filter((record) => record.userId === userId);
  return {
    data: localRecords,
    total: localRecords.length,
    source: "local"
  };
}

export async function getSubmissionRecord(submissionId: string): Promise<SubmissionRecord | null> {
  const localRecord = (await readLocalSubmissions()).find((record) => record.submissionId === submissionId);
  return localRecord ?? null;
}
