import { getSafeImageFileName } from "./uploadNormalization";

export type UploadQueueStatus =
  | "pending"
  | "uploading"
  | "success"
  | "failed"
  | "canceled"
  | "waiting-retry";

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
  canceled: "已取消",
  "waiting-retry": "待重试"
};

export function createUploadQueue(filePaths: string[]): UploadQueueItem[] {
  return filePaths.map((filePath, index) => ({
    filePath,
    label: `图片 ${index + 1}`,
    safeName: getSafeImageFileName(filePath, `图片 ${index + 1}`),
    thumbUrl: filePath,
    status: "pending"
  }));
}

export function updateUploadQueueStatus(
  queue: UploadQueueItem[],
  filePath: string,
  status: UploadQueueStatus,
  message = ""
): UploadQueueItem[] {
  return queue.map((item) => (item.filePath === filePath ? { ...item, status, message } : item));
}

export function markUploadQueueInterrupted(
  queue: UploadQueueItem[],
  remainingFilePaths: string[],
  interruptedFilePath: string,
  interruptedStatus: "failed" | "canceled",
  interruptedMessage: string
): UploadQueueItem[] {
  const remaining = new Set(remainingFilePaths);

  return queue.map((item) => {
    if (!remaining.has(item.filePath)) {
      return item;
    }

    if (item.filePath === interruptedFilePath) {
      return { ...item, status: interruptedStatus, message: interruptedMessage };
    }

    return {
      ...item,
      status: "waiting-retry",
      message: "前序图片未完成，尚未上传"
    };
  });
}

export function markUploadQueueThumbFailed(queue: UploadQueueItem[], filePath: string): UploadQueueItem[] {
  return queue.map((item) => (item.filePath === filePath ? { ...item, thumbFailed: true } : item));
}

export function removeUploadQueueItem(queue: UploadQueueItem[], filePath: string): UploadQueueItem[] {
  return queue.filter((item) => item.filePath !== filePath);
}

export function shouldShowUploadQueue(queue: UploadQueueItem[], retryFilePathSet: Set<string>): boolean {
  return (
    queue.length > 1 ||
    queue.some(
      (item) =>
        retryFilePathSet.has(item.filePath) &&
        (item.status === "failed" || item.status === "canceled" || item.status === "waiting-retry")
    )
  );
}
