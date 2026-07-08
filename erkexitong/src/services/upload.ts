import Taro from "@tarojs/taro";
import { API_BASE_URL, ApiError, hasApiBaseUrl } from "./api";
import { useUserStore } from "../stores/useUserStore";
import type { EvaluationRecordMap, ProofImage } from "../types/evaluation";
import type { UploadedImage } from "../types/content";
import { createId } from "../utils/id";

interface ChooseOptions {
  count?: number;
  sourceType?: Array<"album" | "camera">;
}

interface UploadResponseShape {
  id?: string;
  original_url?: string;
  originalUrl?: string;
  thumb_url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
}

export async function chooseLocalImages(options: ChooseOptions = {}): Promise<ProofImage[]> {
  const result = await Taro.chooseImage({
    count: options.count ?? 3,
    sourceType: options.sourceType ?? ["album", "camera"]
  });

  return result.tempFilePaths.map((path) => ({
    id: createId("image"),
    url: path,
    thumbUrl: path,
    uploaded: false
  }));
}

function normalizeUploadResponse(raw: string): UploadedImage {
  const parsed = JSON.parse(raw) as UploadResponseShape;
  const originalUrl = parsed.originalUrl ?? parsed.original_url ?? "";

  if (!originalUrl) {
    throw new Error("Upload response missing original_url");
  }

  return {
    id: parsed.id ?? createId("uploaded"),
    originalUrl,
    thumbUrl: parsed.thumbUrl ?? parsed.thumb_url,
    width: parsed.width,
    height: parsed.height,
    size: parsed.size
  };
}

export async function uploadFilePath(filePath: string): Promise<UploadedImage> {
  if (!hasApiBaseUrl) {
    throw new ApiError("未配置后端地址，无法上传图片");
  }

  const { token } = useUserStore.getState();
  const uploadResult = await Taro.uploadFile({
    url: `${API_BASE_URL}/upload`,
    filePath,
    name: "file",
    header: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
    throw new ApiError(`图片上传失败：${uploadResult.statusCode}`, uploadResult.statusCode);
  }

  return normalizeUploadResponse(uploadResult.data);
}

export async function chooseAndUpload(options: ChooseOptions = {}): Promise<UploadedImage[]> {
  const chooseResult = await Taro.chooseImage({
    count: options.count ?? 3,
    sourceType: options.sourceType ?? ["album", "camera"]
  });
  const uploaded: UploadedImage[] = [];

  for (const filePath of chooseResult.tempFilePaths) {
    uploaded.push(await uploadFilePath(filePath));
  }

  return uploaded;
}

export function uploadedToProofImage(image: UploadedImage): ProofImage {
  return {
    id: image.id,
    url: image.originalUrl,
    thumbUrl: image.thumbUrl ?? image.originalUrl,
    width: image.width,
    height: image.height,
    size: image.size,
    uploaded: true
  };
}

export async function uploadLocalProofImages(records: EvaluationRecordMap): Promise<EvaluationRecordMap> {
  const nextRecords: EvaluationRecordMap = {};

  for (const [key, list] of Object.entries(records)) {
    nextRecords[key] = [];

    for (const record of list) {
      const images: ProofImage[] = [];

      for (const image of record.images) {
        if (image.uploaded) {
          images.push(image);
        } else {
          images.push(uploadedToProofImage(await uploadFilePath(image.url)));
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
