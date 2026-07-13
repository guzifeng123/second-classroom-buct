import { PropsWithChildren, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Text, View } from "@tarojs/components";
import { rememberUploadedImage } from "../../services/imageLibraryService";
import {
  chooseImageFiles,
  localFilesToProofImages,
  precheckLocalImages,
  type UploadProgressSnapshot,
  uploadFilePath,
  uploadedToProofImage
} from "../../services/upload";
import type { ProofImage } from "../../types/evaluation";
import { buildChooseImageFailureMessage, buildUploadFailureMessage } from "../../utils/feedbackMessages";
import { uploadQueueStatusText, useUploadQueue } from "./useUploadQueue";
import "./index.scss";

interface UploadImageButtonProps {
  onUploaded: (images: ProofImage[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  remaining?: number;
  strategy?: "local" | "upload";
  variant?: "default" | "toolbar" | "compact";
  className?: string;
  wrapClassName?: string;
}

export default function UploadImageButton({
  onUploaded,
  multiple = true,
  disabled = false,
  remaining = 3,
  strategy = "local",
  variant = "default",
  className,
  wrapClassName,
  children
}: PropsWithChildren<UploadImageButtonProps>) {
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState("");
  const [precheckMessages, setPrecheckMessages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressSnapshot | null>(null);
  const {
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
  } = useUploadQueue();
  const currentUploadTaskRef = useRef<Taro.UploadTask | null>(null);
  const cancelUploadRef = useRef(false);
  const partialUploadMessageRef = useRef("");
  const buttonClassName = [
    "upload-image-button",
    `upload-image-button--${variant}`,
    className
  ]
    .filter(Boolean)
    .join(" ");
  const wrapperClassName = ["upload-image-button-wrap", wrapClassName].filter(Boolean).join(" ");

  const uploadSelectedPaths = async (filePaths: string[]) => {
    const uploadedImages: ProofImage[] = [];
    partialUploadMessageRef.current = "";
    resetQueue(filePaths);

    setUploadProgress(
      filePaths.length > 0 ? { filePath: filePaths[0], fileIndex: 0, fileCount: filePaths.length, progress: 0 } : null
    );

    for (const [index, filePath] of filePaths.entries()) {
      try {
        updateQueueStatus(filePath, "uploading");
        const uploaded = await uploadFilePath(filePath, {
          fileIndex: index,
          fileCount: filePaths.length,
          onProgress: setUploadProgress,
          onTask: (task) => {
            currentUploadTaskRef.current = task;
          }
        });
        await rememberUploadedImage(uploaded);
        const proofImage = uploadedToProofImage(uploaded);
        uploadedImages.push(proofImage);
        updateQueueStatus(filePath, "success");
      } catch (error) {
        const remainingFilePaths = filePaths.slice(index);
        const failedMessage = cancelUploadRef.current ? "已取消上传" : buildUploadFailureMessage(error);
        setRetryFilePaths(remainingFilePaths);
        markRemainingQueueStatus(
          remainingFilePaths,
          cancelUploadRef.current ? "canceled" : "failed",
          (path) => (path === filePath ? failedMessage : "前序图片未完成，等待重试")
        );
        if (uploadedImages.length > 0) {
          onUploaded(uploadedImages);
          partialUploadMessageRef.current = `已成功上传 ${uploadedImages.length} 张，剩余 ${
            filePaths.length - index
          } 张可重试。`;
          setLastError(partialUploadMessageRef.current);
        }
        currentUploadTaskRef.current = null;
        throw error;
      }
    }

    if (uploadedImages.length > 0) {
      onUploaded(uploadedImages);
    }
    setRetryFilePaths([]);
    setLastError("");
    setUploadProgress(null);
    currentUploadTaskRef.current = null;
    partialUploadMessageRef.current = "";
  };

  const handleUploadCanceled = () => {
    setUploadProgress(null);
    setLastError(
      partialUploadMessageRef.current
        ? `${partialUploadMessageRef.current}\n已取消上传，可点击重试或重新选择图片。`
        : "已取消上传，可点击重试或重新选择图片。"
    );
    currentUploadTaskRef.current = null;
    cancelUploadRef.current = false;
    partialUploadMessageRef.current = "";
  };

  const handleChoose = async () => {
    if (disabled || loading || remaining <= 0) {
      return;
    }

    setLoading(true);
    try {
      const count = multiple ? remaining : 1;
      setLastError("");
      setPrecheckMessages([]);
      setUploadProgress(null);
      cancelUploadRef.current = false;
      partialUploadMessageRef.current = "";
      clearQueue();

      const files = await chooseImageFiles({ count });
      const precheck = precheckLocalImages(files);
      setPrecheckMessages(precheck.issues.map((issue) => issue.message));

      if (strategy === "upload") {
        const filePaths = precheck.accepted.map((file) => file.path);
        setRetryFilePaths(filePaths);
        await uploadSelectedPaths(filePaths);
      } else {
        const images = localFilesToProofImages(precheck.accepted);
        setRetryFilePaths([]);
        clearQueue();
        onUploaded(images);
      }
    } catch (error) {
      setUploadProgress(null);
      const message = error instanceof Error ? error.message : "";
      if (cancelUploadRef.current || message.includes("abort")) {
        handleUploadCanceled();
        return;
      }
      if (!message.includes("cancel")) {
        const displayMessage =
          strategy === "upload" ? buildUploadFailureMessage(error) : buildChooseImageFailureMessage(error);
        const nextMessage = partialUploadMessageRef.current
          ? `${partialUploadMessageRef.current}\n${displayMessage}`
          : displayMessage;
        setLastError(nextMessage);
        partialUploadMessageRef.current = "";
        await Taro.showToast({
          title: displayMessage,
          icon: "none"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (disabled || loading || retryFilePaths.length === 0) {
      return;
    }

    setLoading(true);
    try {
      setLastError("");
      cancelUploadRef.current = false;
      partialUploadMessageRef.current = "";
      clearQueue();
      await uploadSelectedPaths(retryFilePaths);
    } catch (error) {
      setUploadProgress(null);
      const message = error instanceof Error ? error.message : "";
      if (cancelUploadRef.current || message.includes("abort")) {
        handleUploadCanceled();
        return;
      }
      const displayMessage = buildUploadFailureMessage(error);
      const nextMessage = partialUploadMessageRef.current
        ? `${partialUploadMessageRef.current}\n${displayMessage}`
        : displayMessage;
      setLastError(nextMessage);
      partialUploadMessageRef.current = "";
      await Taro.showToast({
        title: displayMessage,
        icon: "none"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryOne = async (filePath: string) => {
    if (disabled || loading || !retryFilePathSet.has(filePath)) {
      return;
    }

    setLoading(true);
    try {
      setLastError("");
      cancelUploadRef.current = false;
      partialUploadMessageRef.current = "";
      updateQueueStatus(filePath, "uploading");
      setUploadProgress({ filePath, fileIndex: 0, fileCount: 1, progress: 0 });

      const uploaded = await uploadFilePath(filePath, {
        fileIndex: 0,
        fileCount: 1,
        onProgress: setUploadProgress,
        onTask: (task) => {
          currentUploadTaskRef.current = task;
        }
      });
      await rememberUploadedImage(uploaded);
      onUploaded([uploadedToProofImage(uploaded)]);
      updateQueueStatus(filePath, "success");

      const nextRetryFilePaths = retryFilePaths.filter((path) => path !== filePath);
      setRetryFilePaths(nextRetryFilePaths);
      setUploadProgress(null);
      currentUploadTaskRef.current = null;

      if (nextRetryFilePaths.length > 0) {
        setLastError(`已重传 1 张，剩余 ${nextRetryFilePaths.length} 张可重试。`);
        return;
      }

      setLastError("");
    } catch (error) {
      setUploadProgress(null);
      currentUploadTaskRef.current = null;
      const message = error instanceof Error ? error.message : "";
      if (cancelUploadRef.current || message.includes("abort")) {
        updateQueueStatus(filePath, "canceled", "已取消上传");
        handleUploadCanceled();
        return;
      }

      const displayMessage = buildUploadFailureMessage(error);
      updateQueueStatus(filePath, "failed", displayMessage);
      setLastError(displayMessage);
      await Taro.showToast({
        title: displayMessage,
        icon: "none"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUpload = () => {
    if (!loading || strategy !== "upload" || !currentUploadTaskRef.current) {
      return;
    }

    cancelUploadRef.current = true;
    setLastError("正在取消上传...");
    currentUploadTaskRef.current.abort();
  };

  const handleRemoveRetryPath = (filePath: string) => {
    if (loading) {
      return;
    }

    const nextRetryFilePaths = removeRetryPath(filePath);
    setUploadProgress(null);

    if (nextRetryFilePaths.length > 0) {
      setLastError(`已移除 1 张，剩余 ${nextRetryFilePaths.length} 张可重试。`);
      return;
    }

    setLastError("");
  };

  return (
    <View className={wrapperClassName}>
      <Button
        className={buttonClassName}
        disabled={disabled || loading || remaining <= 0}
        loading={loading}
        onClick={handleChoose}
      >
        {children ?? (loading && strategy === "upload" ? "上传中" : remaining > 0 ? `图片 ${remaining}` : "图片已满")}
      </Button>
      {uploadProgress ? (
        <View className="upload-image-button__progress">
          <View className="upload-image-button__progress-head">
            <Text className="upload-image-button__progress-text">
              上传第 {uploadProgress.fileIndex + 1}/{uploadProgress.fileCount} 张
            </Text>
            <Text className="upload-image-button__progress-percent">{uploadProgress.progress}%</Text>
          </View>
          <View className="upload-image-button__progress-track">
            <View
              className="upload-image-button__progress-value"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </View>
          {strategy === "upload" ? (
            <Button className="upload-image-button__cancel" onClick={handleCancelUpload}>
              取消上传
            </Button>
          ) : null}
        </View>
      ) : null}
      {shouldShowUploadQueue ? (
        <View className="upload-image-button__queue">
          {uploadQueue.map((item, index) => (
            <View
              className={`upload-image-button__queue-item upload-image-button__queue-item--${item.status}`}
              key={`${item.filePath}-${index}`}
            >
              <View className="upload-image-button__queue-main">
                {item.thumbFailed ? (
                  <View className="upload-image-button__queue-thumb upload-image-button__queue-thumb--fallback">
                    <Text className="upload-image-button__queue-thumb-text">图</Text>
                  </View>
                ) : (
                  <Image
                    className="upload-image-button__queue-thumb"
                    mode="aspectFill"
                    src={item.thumbUrl}
                    onError={() => markQueueThumbFailed(item.filePath)}
                  />
                )}
                <View className="upload-image-button__queue-title">
                  <Text className="upload-image-button__queue-name">{item.label}</Text>
                  <Text className="upload-image-button__queue-file">{item.safeName}</Text>
                </View>
              </View>
              <View className="upload-image-button__queue-meta">
                <View className="upload-image-button__queue-state">
                  <Text className="upload-image-button__queue-status">{uploadQueueStatusText[item.status]}</Text>
                  {item.message ? (
                    <Text className="upload-image-button__queue-message">{item.message}</Text>
                  ) : null}
                </View>
                {retryFilePathSet.has(item.filePath) &&
                (item.status === "failed" || item.status === "canceled") ? (
                  <>
                    <Button
                      className="upload-image-button__queue-retry"
                      disabled={loading}
                      onClick={() => handleRetryOne(item.filePath)}
                    >
                      重传
                    </Button>
                    <Button
                      className="upload-image-button__queue-remove"
                      disabled={loading}
                      onClick={() => handleRemoveRetryPath(item.filePath)}
                    >
                      移除
                    </Button>
                  </>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {precheckMessages.length > 0 ? (
        <View className="upload-image-button__tips">
          {precheckMessages.slice(0, 2).map((message, index) => (
            <Text className="upload-image-button__tip" key={`${message}-${index}`}>
              {message}
            </Text>
          ))}
          {precheckMessages.length > 2 ? (
            <Text className="upload-image-button__tip">还有 {precheckMessages.length - 2} 项图片提示</Text>
          ) : null}
        </View>
      ) : null}
      {lastError ? (
        <View className="upload-image-button__error">
          <Text className="upload-image-button__error-text">{lastError}</Text>
          {strategy === "upload" && retryFilePaths.length > 0 ? (
            <Button className="upload-image-button__retry" disabled={loading} onClick={handleRetry}>
              重试
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
