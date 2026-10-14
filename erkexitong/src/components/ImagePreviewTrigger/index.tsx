import { View } from "@tarojs/components";
import type { ImagePreviewTriggerProps } from "./types";

export default function ImagePreviewTrigger({
  children,
  className,
  onActivate
}: ImagePreviewTriggerProps) {
  return (
    <View className={className} onClick={onActivate}>
      {children}
    </View>
  );
}
