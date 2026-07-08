import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Text, View } from "@tarojs/components";
import UploadImageButton from "../../../components/UploadImageButton";
import { EmptyState, FeedbackButton, StatusBanner } from "../../../components/ui";
import { fetchImages, type ImageAsset } from "../../../services/imageLibraryService";
import { useUserStore } from "../../../stores/useUserStore";
import type { ProofImage } from "../../../types/evaluation";
import "./index.scss";

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

export default function ImageLibraryPage() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "remote">("local");
  const [error, setError] = useState("");

  const loadImages = async () => {
    setLoading(true);
    try {
      const result = await fetchImages(0, 40);
      setImages(result.data);
      setSource(result.source);
      setError(result.error ?? "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "图片列表读取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadImages();
  }, []);

  const handleUploaded = (_nextImages: ProofImage[]) => {
    void loadImages();
  };

  const handlePreview = async (image: ImageAsset) => {
    await Taro.previewImage({
      urls: images.map((candidate) => candidate.originalUrl),
      current: image.originalUrl
    });
  };

  if (!isLoggedIn) {
    return (
      <View className="page-shell image-library image-library--gate">
        <Text className="image-library__gate-title">未登录</Text>
        <Button
          className="image-library__gate-button"
          onClick={() => Taro.redirectTo({ url: "/pages/login/index" })}
        >
          返回登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-shell image-library">
      <View className="image-library__hero">
        <View>
          <Text className="image-library__label">图片与附件库</Text>
          <Text className="image-library__title">{userId}</Text>
          <Text className="image-library__sub">集中查看证明图片，上传后可在后续材料中复用。</Text>
        </View>
        <Button className="image-library__back" onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}>
          评定页
        </Button>
      </View>

      <View className="image-library__tools">
        <UploadImageButton
          multiple
          remaining={9}
          strategy="upload"
          variant="toolbar"
          className="image-library__upload"
          onUploaded={handleUploaded}
        >
          上传图片
        </UploadImageButton>
        <FeedbackButton className="image-library__refresh" loadingText="刷新中" onClick={loadImages}>
          刷新
        </FeedbackButton>
      </View>

      <View className="image-library__status">
        <Text>{source === "remote" ? "远端图片" : "本地图片"}</Text>
        <Text>{images.length} 张</Text>
      </View>

      {error ? <StatusBanner tone="danger" title="图片同步失败" description={error} /> : null}

      {images.length === 0 ? (
        <EmptyState
          title={loading ? "正在读取图片库" : "还没有图片"}
          description="上传证明照片后，这里会形成个人附件库。"
        />
      ) : (
        <View className="image-library__grid">
          {images.map((image) => (
            <View className="image-library__asset" key={image.id} onClick={() => handlePreview(image)}>
              <Image className="image-library__thumb" src={image.thumbUrl ?? image.originalUrl} mode="aspectFill" />
              <View className="image-library__asset-meta">
                <Text className="image-library__asset-name">{image.id}</Text>
                <Text className="image-library__asset-detail">
                  {formatSize(image.size)} · {formatTime(image.uploadedAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
