import { useEffect } from "react";
import Taro from "@tarojs/taro";
import type { ImagePreviewProps } from "./types";

export type { ImagePreviewProps, ImagePreviewRequest } from "./types";

export default function ImagePreview({ request, onClose }: ImagePreviewProps) {
  useEffect(() => {
    if (!request) {
      return;
    }

    const urls = Array.from(new Set(request.urls.filter(Boolean)));
    if (urls.length === 0) {
      onClose();
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      const openPreview = async () => {
        try {
          await Taro.previewImage({
            urls,
            current: urls.includes(request.current) ? request.current : urls[0]
          });
        } finally {
          if (active) {
            onClose();
          }
        }
      };

      void openPreview().catch(() => undefined);
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [onClose, request]);

  return null;
}
