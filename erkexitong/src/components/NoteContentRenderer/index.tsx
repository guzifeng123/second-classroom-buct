import { useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import type { ContentBlock } from "../../types/content";
import "./index.scss";

interface NoteContentRendererProps {
  content: ContentBlock[];
  emptyText?: string;
  enableImagePreview?: boolean;
  onError?: (block: ContentBlock, error: unknown) => void;
}

export default function NoteContentRenderer({
  content,
  emptyText = "暂无内容",
  enableImagePreview = false,
  onError
}: NoteContentRendererProps) {
  const [failedImageKeys, setFailedImageKeys] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const imageUrls = useMemo(
    () =>
      content.reduce<string[]>((urls, block) => {
        if (block.type === "image" && block.url) {
          urls.push(block.url);
        }

        return urls;
      }, []),
    [content]
  );

  if (content.length === 0) {
    return <View className="note-renderer__empty">{emptyText}</View>;
  }

  const handlePreviewImage = (url: string) => {
    if (!enableImagePreview || !url) {
      return;
    }

    setPreviewUrl(url);
  };

  return (
    <View className="note-renderer">
      {content.map((block, index) => {
        if (block.type === "heading") {
          return (
            <View className={`note-renderer__heading note-renderer__heading--${block.level ?? 2}`} key={index}>
              <Text>{block.text}</Text>
            </View>
          );
        }

        if (block.type === "paragraph") {
          return (
            <View className="note-renderer__paragraph" key={index}>
              <Text>{block.text}</Text>
            </View>
          );
        }

        if (block.type === "image") {
          const imageKey = `${index}:${block.url}`;
          const failed = failedImageKeys.includes(imageKey);

          return (
            <View
              className={`note-renderer__image-wrap ${enableImagePreview ? "note-renderer__image-wrap--preview" : ""}`}
              key={index}
              onClick={() => handlePreviewImage(block.url)}
            >
              {failed ? (
                <View className="note-renderer__image-fallback">
                  <Text className="note-renderer__image-fallback-title">图片暂不可预览</Text>
                  <Text className="note-renderer__image-fallback-copy">{block.alt || "快照图片加载失败"}</Text>
                </View>
              ) : (
                <Image
                  className="note-renderer__image"
                  src={block.thumbUrl ?? block.url}
                  mode="widthFix"
                  lazyLoad
                  onError={(error) => {
                    setFailedImageKeys((keys) => (keys.includes(imageKey) ? keys : [...keys, imageKey]));
                    onError?.(block, error);
                  }}
                />
              )}
            </View>
          );
        }

        return (
          <View className="note-renderer__other" key={index}>
            <Text>{JSON.stringify(block.data)}</Text>
          </View>
        );
      })}
      {enableImagePreview && previewUrl ? (
        <View className="note-renderer__preview" onClick={() => setPreviewUrl("")}>
          <View className="note-renderer__preview-body">
            <Image className="note-renderer__preview-image" src={previewUrl} mode="aspectFit" />
            <Text className="note-renderer__preview-count">
              {Math.max(imageUrls.indexOf(previewUrl), 0) + 1}/{imageUrls.length || 1}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
