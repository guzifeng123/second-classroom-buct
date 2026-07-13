import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { UploadedImage } from "../types/content";
import type { ProofImage } from "../types/evaluation";
import {
  imageAssetToProofImage as convertImageAssetToProofImage,
  mergeImageUsageMetadata,
  normalizeImageAsset,
  normalizeImageAssetList,
  normalizeStoredImageAsset,
  type ImageAsset,
  type ImageListApiResponse,
  type ImageUsageContext
} from "../utils/imageLibraryNormalization";

const LOCAL_IMAGES_KEY = "erkexitong-image-library";
export type { ImageAsset, ImageUsageContext } from "../utils/imageLibraryNormalization";

export interface ImageListResult {
  data: ImageAsset[];
  total: number;
  source: "local" | "remote";
  error?: string;
}

async function readLocalImages(): Promise<ImageAsset[]> {
  try {
    const result = await Taro.getStorage<ImageAsset[]>({ key: LOCAL_IMAGES_KEY });
    return Array.isArray(result.data) ? result.data.map(normalizeStoredImageAsset) : [];
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
  const normalized = normalizeImageAsset({
    id: image.id,
    originalUrl: image.originalUrl,
    thumbUrl: image.thumbUrl,
    width: image.width,
    height: image.height,
    size: image.size,
    uploadedAt: Date.now()
  });
  const images = await readLocalImages();
  const nextImage = mergeImageUsageMetadata(
    normalized,
    images.find((candidate) => candidate.id === normalized.id)
  );
  const nextImages = [nextImage, ...images.filter((candidate) => candidate.id !== normalized.id)].sort(
    (left, right) => right.uploadedAt - left.uploadedAt
  );

  await writeLocalImages(nextImages);
  return nextImage;
}

export async function markImageAssetUsed(imageId: string, context: ImageUsageContext): Promise<void> {
  const images = await readLocalImages();
  const now = Date.now();
  const nextImages = images.map((image) =>
    image.id === imageId
      ? {
          ...image,
          recentUsedAt: now,
          usedCount: (image.usedCount ?? 0) + 1,
          lastUsedDimensionKey: context.dimensionKey,
          lastUsedSectionKey: context.sectionKey,
          lastUsedItemId: context.itemId
        }
      : image
  );

  await writeLocalImages(nextImages);
}

export async function fetchImages(offset = 0, limit = 20): Promise<ImageListResult> {
  if (hasApiBaseUrl) {
    try {
      const remoteImages = normalizeImageAssetList(
        await request<ImageListApiResponse>({
          url: `/images?offset=${offset}&limit=${limit}`
        })
      );

      const localImages = await readLocalImages();
      const remoteWithLocalUsage = remoteImages.map((image) =>
        mergeImageUsageMetadata(
          image,
          localImages.find((candidate) => candidate.id === image.id)
        )
      );
      const cached = offset === 0 ? remoteWithLocalUsage : [...localImages, ...remoteWithLocalUsage];
      await writeLocalImages(cached);

      return {
        data: remoteWithLocalUsage,
        total: remoteWithLocalUsage.length,
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

export function imageAssetToProofImage(image: ImageAsset): ProofImage {
  return convertImageAssetToProofImage(image);
}
