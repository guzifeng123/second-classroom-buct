import { useCallback, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import type { ContentBlock } from "../../types/content";
import ImagePreview, { type ImagePreviewRequest } from "../ImagePreview";
import ImagePreviewTrigger from "../ImagePreviewTrigger";
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
  const [previewRequest, setPreviewRequest] = useState<ImagePreviewRequest | null>(null);
  const imageUrls = useMemo(
    () =>
      Array.from(
        new Set(
          content.reduce<string[]>((urls, block) => {
            if (block.type === "image" && block.url) {
              urls.push(block.url);
            }

            return urls;
          }, [])
        )
      ),
    [content]
  );

  const handlePreviewClose = useCallback(() => {
    setPreviewRequest(null);
  }, []);

  if (content.length === 0) {
    return <View className="note-renderer__empty">{emptyText}</View>;
  }

  const handlePreviewImage = (url: string) => {
    if (!enableImagePreview || !url) {
      return;
    }

    setPreviewRequest({
      current: url,
      urls: imageUrls
    });
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
            <ImagePreviewTrigger
              ariaLabel={`预览图片 ${block.alt || index + 1}`}
              className={`note-renderer__image-wrap ${enableImagePreview ? "note-renderer__image-wrap--preview" : ""}`}
              enabled={enableImagePreview}
              key={index}
              onActivate={() => handlePreviewImage(block.url)}
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
            </ImagePreviewTrigger>
          );
        }

        return (
          <View className="note-renderer__other" key={index}>
            <Text>{JSON.stringify(block.data)}</Text>
          </View>
        );
      })}
      {enableImagePreview ? <ImagePreview request={previewRequest} onClose={handlePreviewClose} /> : null}
    </View>
  );
}
