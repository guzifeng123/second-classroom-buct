import { Image, Text, View } from "@tarojs/components";
import { evaluationConfig, findEvaluationItem } from "../../../../data/evaluationConfig";
import type { ImageAsset } from "../../../../services/imageLibraryService";
import type { DimensionKey } from "../../../../types/evaluation";

interface ImageLibraryGridProps {
  images: ImageAsset[];
  onPreview: (image: ImageAsset) => void;
}

function formatSize(size?: number): string {
  if (!size) {
    return "未知大小";
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

function formatUsage(image: ImageAsset): string {
  if (!image.usedCount) {
    return "未被材料引用";
  }

  const usedAt = image.recentUsedAt ? ` · 最近 ${formatTime(image.recentUsedAt)}` : "";
  const targetItem = image.lastUsedItemId ? findEvaluationItem(image.lastUsedItemId) : undefined;
  const target = targetItem ? ` · ${targetItem.title}` : "";
  return `已引用 ${image.usedCount} 次${usedAt}${target}`;
}

function getDimensionTitle(dimensionKey: DimensionKey): string {
  return evaluationConfig.find((dimension) => dimension.key === dimensionKey)?.title ?? dimensionKey;
}

export default function ImageLibraryGrid({ images, onPreview }: ImageLibraryGridProps) {
  return (
    <View className="image-library__grid">
      {images.map((image) => (
        <View className="image-library__asset" key={image.id} onClick={() => onPreview(image)}>
          <Image className="image-library__thumb" src={image.thumbUrl ?? image.originalUrl} mode="aspectFill" />
          <View className="image-library__asset-meta">
            <Text className="image-library__asset-name">{image.id}</Text>
            <Text className="image-library__asset-detail">
              {formatSize(image.size)} · {formatTime(image.uploadedAt)}
            </Text>
            <Text className="image-library__asset-detail">{formatUsage(image)}</Text>
            {image.lastUsedDimensionKey ? (
              <Text className="image-library__asset-tag">{getDimensionTitle(image.lastUsedDimensionKey)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
