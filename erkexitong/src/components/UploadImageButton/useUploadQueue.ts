import { useMemo, useState } from "react";
import {
  createUploadQueue,
  markUploadQueueInterrupted,
  markUploadQueueThumbFailed,
  removeUploadQueueItem,
  shouldShowUploadQueue as getShouldShowUploadQueue,
  updateUploadQueueStatus,
  uploadQueueStatusText,
  type UploadQueueItem,
  type UploadQueueStatus
} from "../../utils/uploadQueue";

export { uploadQueueStatusText } from "../../utils/uploadQueue";

export function useUploadQueue() {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [retryFilePaths, setRetryFilePaths] = useState<string[]>([]);

  const retryFilePathSet = useMemo(() => new Set(retryFilePaths), [retryFilePaths]);
  const shouldShowUploadQueue = useMemo(
    () => getShouldShowUploadQueue(uploadQueue, retryFilePathSet),
    [retryFilePathSet, uploadQueue]
  );

  const resetQueue = (filePaths: string[]) => {
    setUploadQueue(createUploadQueue(filePaths));
  };

  const clearQueue = () => {
    setUploadQueue([]);
  };

  const updateQueueStatus = (filePath: string, status: UploadQueueStatus, message = "") => {
    setUploadQueue((queue) => updateUploadQueueStatus(queue, filePath, status, message));
  };

  const markQueueInterrupted = (
    remainingFilePaths: string[],
    interruptedFilePath: string,
    interruptedStatus: "failed" | "canceled",
    interruptedMessage: string
  ) => {
    setUploadQueue((queue) =>
      markUploadQueueInterrupted(
        queue,
        remainingFilePaths,
        interruptedFilePath,
        interruptedStatus,
        interruptedMessage
      )
    );
  };

  const markQueueThumbFailed = (filePath: string) => {
    setUploadQueue((queue) => markUploadQueueThumbFailed(queue, filePath));
  };

  const removeRetryPath = (filePath: string) => {
    const nextRetryFilePaths = retryFilePaths.filter((path) => path !== filePath);
    setRetryFilePaths(nextRetryFilePaths);
    setUploadQueue((queue) => removeUploadQueueItem(queue, filePath));
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
    markQueueInterrupted,
    markQueueThumbFailed,
    removeRetryPath
  };
}
