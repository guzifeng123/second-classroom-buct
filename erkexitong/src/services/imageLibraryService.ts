import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { UploadedImage } from "../types/content";
import { createId } from "../utils/id";

const LOCAL_IMAGES_KEY = "erkexitong-image-library";

export interface ImageAsset {
  id: string;
  originalUrl: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  uploadedAt: number;
}

interface ImageApiResponse {
  id?: string;
  original_url?: string;
  originalUrl?: string;
  url?: string;
  thumb_url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  uploaded_at?: string;
  uploadedAt?: number;
}

type ImageListApiResponse = ImageApiResponse[] | { data?: ImageApiResponse[]; total?: number };

export interface ImageListResult {
  data: ImageAsset[];
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

function normalizeImage(raw: ImageApiResponse): ImageAsset {
  const originalUrl = raw.originalUrl ?? raw.original_url ?? raw.url ?? "";

  return {
    id: raw.id ?? createId("image"),
    originalUrl,
    thumbUrl: raw.thumbUrl ?? raw.thumb_url ?? originalUrl,
    width: raw.width,
    height: raw.height,
    size: raw.size,
    uploadedAt: parseTime(raw.uploadedAt ?? raw.uploaded_at)
  };
}

function normalizeList(raw: ImageListApiResponse): ImageAsset[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeImage).filter((image) => image.originalUrl);
}

async function readLocalImages(): Promise<ImageAsset[]> {
  try {
    const result = await Taro.getStorage<ImageAsset[]>({ key: LOCAL_IMAGES_KEY });
    return Array.isArray(result.data) ? result.data : [];
  } catch {
    return [];
  }
}

async function writeLocalImages(images: ImageAsset[]): Promise<void> {
  await Taro.setStorage({
    key: LOCAL_IMAGES_KEY,
    data: images
  });
}

export async function rememberUploadedImage(image: UploadedImage): Promise<ImageAsset> {
  const normalized = normalizeImage({
    id: image.id,
    originalUrl: image.originalUrl,
    thumbUrl: image.thumbUrl,
    width: image.width,
    height: image.height,
    size: image.size,
    uploadedAt: Date.now()
  });
  const images = await readLocalImages();
  const nextImages = [normalized, ...images.filter((candidate) => candidate.id !== normalized.id)].sort(
    (left, right) => right.uploadedAt - left.uploadedAt
  );

  await writeLocalImages(nextImages);
  return normalized;
}

export async function fetchImages(offset = 0, limit = 20): Promise<ImageListResult> {
  if (hasApiBaseUrl) {
    try {
      const remoteImages = normalizeList(
        await request<ImageListApiResponse>({
          url: `/images?offset=${offset}&limit=${limit}`
        })
      );

      const cached = offset === 0 ? remoteImages : [...(await readLocalImages()), ...remoteImages];
      await writeLocalImages(cached);

      return {
        data: remoteImages,
        total: Array.isArray(remoteImages) ? remoteImages.length : 0,
        source: "remote"
      };
    } catch (error) {
      const localImages = (await readLocalImages()).slice(offset, offset + limit);

      return {
        data: localImages,
        total: localImages.length,
        source: "local",
        error: getErrorMessage(error, "远端图片列表读取失败")
      };
    }
  }

  const localImages = (await readLocalImages()).slice(offset, offset + limit);
  return {
    data: localImages,
    total: localImages.length,
    source: "local"
  };
}
