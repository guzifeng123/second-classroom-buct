import { useMemo, useState } from "react";
import { getSafeImageFileName } from "../../services/upload";

export type UploadQueueStatus = "pending" | "uploading" | "success" | "failed" | "canceled";

export interface UploadQueueItem {
  filePath: string;
  label: string;
  safeName: string;
  thumbUrl: string;
  thumbFailed?: boolean;
  status: UploadQueueStatus;
  message?: string;
}

export const uploadQueueStatusText: Record<UploadQueueStatus, string> = {
  pending: "等待",
  uploading: "上传中",
  success: "成功",
  failed: "失败",
  canceled: "已取消"
};

export function useUploadQueue() {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [retryFilePaths, setRetryFilePaths] = useState<string[]>([]);

  const retryFilePathSet = useMemo(() => new Set(retryFilePaths), [retryFilePaths]);
  const shouldShowUploadQueue = useMemo(
    () =>
      uploadQueue.length > 1 ||
      uploadQueue.some(
        (item) =>
          retryFilePathSet.has(item.filePath) && (item.status === "failed" || item.status === "canceled")
      ),
    [retryFilePathSet, uploadQueue]
  );

  const resetQueue = (filePaths: string[]) => {
    setUploadQueue(
      filePaths.map((filePath, index) => ({
        filePath,
        label: `图片 ${index + 1}`,
        safeName: getSafeImageFileName(filePath, `图片 ${index + 1}`),
        thumbUrl: filePath,
        status: "pending"
      }))
    );
  };

  const clearQueue = () => {
    setUploadQueue([]);
  };

  const updateQueueStatus = (filePath: string, status: UploadQueueStatus, message = "") => {
    setUploadQueue((queue) =>
      queue.map((item) => (item.filePath === filePath ? { ...item, status, message } : item))
    );
  };

  const markRemainingQueueStatus = (
    filePaths: string[],
    status: UploadQueueStatus,
    getMessage?: (filePath: string) => string
  ) => {
    const remaining = new Set(filePaths);
    setUploadQueue((queue) =>
      queue.map((item) =>
        remaining.has(item.filePath) ? { ...item, status, message: getMessage?.(item.filePath) ?? "" } : item
      )
    );
  };

  const markQueueThumbFailed = (filePath: string) => {
    setUploadQueue((queue) =>
      queue.map((item) => (item.filePath === filePath ? { ...item, thumbFailed: true } : item))
    );
  };

  const removeRetryPath = (filePath: string) => {
    const nextRetryFilePaths = retryFilePaths.filter((path) => path !== filePath);
    setRetryFilePaths(nextRetryFilePaths);
    setUploadQueue((queue) => queue.filter((item) => item.filePath !== filePath));
    return nextRetryFilePaths;
  };

  return {
    uploadQueue,
    retryFilePaths,
    retryFilePathSet,
    shouldShowUploadQueue,
    setRetryFilePaths,
    resetQueue,
    clearQueue,
    updateQueueStatus,
    markRemainingQueueStatus,
    markQueueThumbFailed,
    removeRetryPath
  };
}
