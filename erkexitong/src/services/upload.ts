import Taro from "@tarojs/taro";
import { API_BASE_URL, ApiError, hasApiBaseUrl } from "./api";
import { useUserStore } from "../stores/useUserStore";
import type { DimensionKey, EvaluationRecordMap, ProofImage, SectionKey } from "../types/evaluation";
import type { UploadedImage } from "../types/content";
import {
  formatFileSize,
  getSafeImageFileName,
  localFilesToProofImages,
  normalizeUploadResponse,
  precheckLocalImages,
  uploadedToProofImage,
  type ImagePrecheckIssue,
  type ImagePrecheckResult,
  type LocalImageFile
} from "../utils/uploadNormalization";

interface ChooseOptions {
  count?: number;
  sourceType?: Array<"album" | "camera">;
}

export interface UploadProgressSnapshot {
  filePath: string;
  fileIndex: number;
  fileCount: number;
  progress: number;
  totalBytesSent?: number;
  totalBytesExpectedToSend?: number;
  dimensionKey?: DimensionKey;
  sectionKey?: SectionKey;
  itemId?: string;
  recordId?: string;
  imageIndex?: number;
}

export interface UploadOptions {
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (task: Taro.UploadTask) => void;
}

export interface UploadLocalProofImagesOptions {
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
}

export {
  formatFileSize,
  getSafeImageFileName,
  localFilesToProofImages,
  precheckLocalImages,
  uploadedToProofImage,
  type ImagePrecheckIssue,
  type ImagePrecheckResult,
  type LocalImageFile
} from "../utils/uploadNormalization";

export async function chooseLocalImages(options: ChooseOptions = {}): Promise<ProofImage[]> {
  return localFilesToProofImages(await chooseImageFiles(options));
}

export async function chooseImageFilePaths(options: ChooseOptions = {}): Promise<string[]> {
  return (await chooseImageFiles(options)).map((file) => file.path);
}

export async function chooseImageFiles(options: ChooseOptions = {}): Promise<LocalImageFile[]> {
  const result = await Taro.chooseImage({
    count: options.count ?? 3,
    sourceType: options.sourceType ?? ["album", "camera"]
  });

  const tempFiles = result.tempFiles ?? [];

  return result.tempFilePaths.map((path, index) => ({
    path,
    size: tempFiles[index]?.size
  }));
}

export async function uploadFilePath(
  filePath: string,
  options: UploadOptions & { fileIndex?: number; fileCount?: number } = {}
): Promise<UploadedImage> {
  if (!hasApiBaseUrl) {
    throw new ApiError("未配置后端地址，无法上传图片");
  }

  const { token } = useUserStore.getState();
  const uploadTask = Taro.uploadFile({
    url: `${API_BASE_URL}/upload`,
    filePath,
    name: "file",
    header: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const fileIndex = options.fileIndex ?? 0;
  const fileCount = options.fileCount ?? 1;
  options.onTask?.(uploadTask);

  uploadTask.onProgressUpdate((result) => {
    options.onProgress?.({
      filePath,
      fileIndex,
      fileCount,
      progress: Math.max(0, Math.min(100, result.progress)),
      totalBytesSent: result.totalBytesSent,
      totalBytesExpectedToSend: result.totalBytesExpectedToSend
    });
  });

  const uploadResult = await uploadTask;

  if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
    throw new ApiError(`图片上传失败：${uploadResult.statusCode}`, uploadResult.statusCode);
  }

  options.onProgress?.({
    filePath,
    fileIndex,
    fileCount,
    progress: 100
  });

  return normalizeUploadResponse(uploadResult.data);
}

export async function chooseAndUpload(options: ChooseOptions = {}): Promise<UploadedImage[]> {
  return uploadFilePaths(await chooseImageFilePaths(options));
}

export async function uploadFilePaths(filePaths: string[], options: UploadOptions = {}): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];

  for (const [index, filePath] of filePaths.entries()) {
    uploaded.push(
      await uploadFilePath(filePath, {
        onProgress: options.onProgress,
        onTask: options.onTask,
        fileIndex: index,
        fileCount: filePaths.length
      })
    );
  }

  return uploaded;
}

export function countLocalProofImages(records: EvaluationRecordMap): number {
  return Object.values(records).reduce(
    (count, list) =>
      count + list.reduce((recordCount, record) => recordCount + record.images.filter((image) => !image.uploaded).length, 0),
    0
  );
}

export async function uploadLocalProofImages(
  records: EvaluationRecordMap,
  options: UploadLocalProofImagesOptions = {}
): Promise<EvaluationRecordMap> {
  const nextRecords: EvaluationRecordMap = {};
  const localImageCount = countLocalProofImages(records);
  let uploadedLocalImageCount = 0;

  for (const [key, list] of Object.entries(records)) {
    nextRecords[key] = [];

    for (const record of list) {
      const images: ProofImage[] = [];

      for (const [imageIndex, image] of record.images.entries()) {
        if (image.uploaded) {
          images.push(image);
        } else {
          const fileIndex = uploadedLocalImageCount;
          const uploadContext = {
            dimensionKey: record.dimensionKey,
            sectionKey: record.sectionKey,
            itemId: record.itemId,
            recordId: record.id,
            imageIndex
          };
          options.onProgress?.({
            filePath: image.url,
            fileIndex,
            fileCount: localImageCount,
            progress: 0,
            ...uploadContext
          });
          images.push(
            uploadedToProofImage(
              await uploadFilePath(image.url, {
                fileIndex,
                fileCount: localImageCount,
                onProgress: (snapshot) => {
                  options.onProgress?.({
                    ...snapshot,
                    ...uploadContext
                  });
                }
              })
            )
          );
          uploadedLocalImageCount += 1;
        }
      }

      nextRecords[key].push({
        ...record,
        images,
        updatedAt: Date.now()
      });
    }
  }

  return nextRecords;
}
