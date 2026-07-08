import { Image, Text, View } from "@tarojs/components";
import type { ContentBlock } from "../../types/content";
import "./index.scss";

interface NoteContentRendererProps {
  content: ContentBlock[];
  emptyText?: string;
  onError?: (block: ContentBlock, error: unknown) => void;
}

export default function NoteContentRenderer({
  content,
  emptyText = "暂无内容",
  onError
}: NoteContentRendererProps) {
  if (content.length === 0) {
    return <View className="note-renderer__empty">{emptyText}</View>;
  }

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
          return (
            <View className="note-renderer__image-wrap" key={index}>
              <Image
                className="note-renderer__image"
                src={block.thumbUrl ?? block.url}
                mode="widthFix"
                lazyLoad
                onError={(error) => onError?.(block, error)}
              />
            </View>
          );
        }

        return (
          <View className="note-renderer__other" key={index}>
            <Text>{JSON.stringify(block.data)}</Text>
          </View>
        );
      })}
    </View>
  );
}
