import type { DimensionKey, ProofImage, SectionKey } from "../types/evaluation";
import { createId } from "./id";

export interface ImageAsset {
  id: string;
  originalUrl: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  uploadedAt: number;
  recentUsedAt?: number;
  usedCount: number;
  lastUsedDimensionKey?: DimensionKey;
  lastUsedSectionKey?: SectionKey;
  lastUsedItemId?: string;
}

export interface ImageUsageContext {
  dimensionKey: DimensionKey;
  sectionKey: SectionKey;
  itemId: string;
}

export interface ImageApiResponse {
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
  recent_used_at?: string | number;
  recentUsedAt?: number;
  used_count?: number;
  usedCount?: number;
  last_used_dimension_key?: DimensionKey;
  lastUsedDimensionKey?: DimensionKey;
  last_used_section_key?: SectionKey;
  lastUsedSectionKey?: SectionKey;
  last_used_item_id?: string;
  lastUsedItemId?: string;
}

export type ImageListApiResponse = ImageApiResponse[] | { data?: ImageApiResponse[]; total?: number };

export function parseImageTime(value?: string | number): number {
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

export function parseOptionalImageTime(value?: string | number): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseImageTime(value);
}

export function normalizeImageAsset(raw: ImageApiResponse): ImageAsset {
  const originalUrl = raw.originalUrl ?? raw.original_url ?? raw.url ?? "";

  return {
    id: raw.id ?? createId("image"),
    originalUrl,
    thumbUrl: raw.thumbUrl ?? raw.thumb_url ?? originalUrl,
    width: raw.width,
    height: raw.height,
    size: raw.size,
    uploadedAt: parseImageTime(raw.uploadedAt ?? raw.uploaded_at),
    recentUsedAt: raw.recentUsedAt ?? parseOptionalImageTime(raw.recent_used_at),
    usedCount: raw.usedCount ?? raw.used_count ?? 0,
    lastUsedDimensionKey: raw.lastUsedDimensionKey ?? raw.last_used_dimension_key,
    lastUsedSectionKey: raw.lastUsedSectionKey ?? raw.last_used_section_key,
    lastUsedItemId: raw.lastUsedItemId ?? raw.last_used_item_id
  };
}

export function normalizeImageAssetList(raw: ImageListApiResponse): ImageAsset[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeImageAsset).filter((image) => image.originalUrl);
}

export function normalizeStoredImageAsset(image: ImageAsset): ImageAsset {
  return {
    ...image,
    usedCount: image.usedCount ?? 0
  };
}

export function mergeImageUsageMetadata(image: ImageAsset, existing?: ImageAsset): ImageAsset {
  if (!existing) {
    return image;
  }

  return {
    ...image,
    recentUsedAt: image.recentUsedAt ?? existing.recentUsedAt,
    usedCount: image.usedCount || existing.usedCount || 0,
    lastUsedDimensionKey: image.lastUsedDimensionKey ?? existing.lastUsedDimensionKey,
    lastUsedSectionKey: image.lastUsedSectionKey ?? existing.lastUsedSectionKey,
    lastUsedItemId: image.lastUsedItemId ?? existing.lastUsedItemId
  };
}

export function imageAssetToProofImage(image: ImageAsset): ProofImage {
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
