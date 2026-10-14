import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { SubmissionRecord } from "../types/submission";
import {
  normalizeRemoteSubmission,
  normalizeStoredSubmission,
  normalizeSubmissionList,
  type SubmissionApiResponse,
  type SubmissionListApiResponse
} from "../utils/submissionNormalization";

const LOCAL_SUBMISSIONS_KEY = "erkexitong-submission-history";

export interface SubmissionListResult {
  data: SubmissionRecord[];
  total: number;
  source: "local" | "remote";
  error?: string;
}

export interface SubmissionDetailResult {
  record: SubmissionRecord | null;
  source: "local" | "remote";
  error?: string;
}

async function readLocalSubmissions(): Promise<SubmissionRecord[]> {
  try {
    const result = await Taro.getStorage<SubmissionRecord[]>({ key: LOCAL_SUBMISSIONS_KEY });
    return Array.isArray(result.data) ? result.data.map(normalizeStoredSubmission) : [];
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
      const remoteRecords = normalizeSubmissionList(
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
  return (await getSubmissionRecordDetail(submissionId)).record;
}

export async function getSubmissionRecordDetail(submissionId: string): Promise<SubmissionDetailResult> {
  const localRecord = (await readLocalSubmissions()).find((record) => record.submissionId === submissionId) ?? null;

  if (!submissionId) {
    return {
      record: null,
      source: "local"
    };
  }

  if (hasApiBaseUrl) {
    try {
      const remoteRecord = normalizeStoredSubmission(
        normalizeRemoteSubmission(
          await request<SubmissionApiResponse>({
            url: `/evaluation-submissions/${encodeURIComponent(submissionId)}`
          })
        )
      );

      if (remoteRecord.submissionId) {
        await saveSubmissionRecord(remoteRecord);
        return {
          record: remoteRecord,
          source: "remote"
        };
      }
    } catch (error) {
      return {
        record: localRecord,
        source: "local",
        error: getErrorMessage(error, "提交详情读取失败")
      };
    }
  }

  return {
    record: localRecord,
    source: "local"
  };
}
