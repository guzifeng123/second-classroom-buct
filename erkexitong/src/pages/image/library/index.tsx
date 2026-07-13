import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { EmptyState, FeedbackButton, StatusBanner } from "../../../components/ui";
import { evaluationConfig } from "../../../data/evaluationConfig";
import { fetchImages, type ImageAsset } from "../../../services/imageLibraryService";
import { useUserStore } from "../../../stores/useUserStore";
import type { DimensionKey, ProofImage } from "../../../types/evaluation";
import "./index.scss";

type SourceFilter = "all" | "remote" | "local";
type UsageFilter = "all" | "used" | "unused";
type DimensionFilter = "all" | DimensionKey;
type SortMode = "uploaded-desc" | "used-desc" | "size-desc";

interface ImageLibraryFilters {
  sourceFilter: SourceFilter;
  dimensionFilter: DimensionFilter;
  usageFilter: UsageFilter;
  sortMode: SortMode;
}

const FILTER_STORAGE_KEY = "erkexitong-image-library-filters";
const ImageLibraryGrid = lazy(() => import("./components/ImageLibraryGrid"));
const UploadImageButton = lazy(() => import("../../../components/UploadImageButton"));
const DEFAULT_FILTERS: ImageLibraryFilters = {
  sourceFilter: "all",
  dimensionFilter: "all",
  usageFilter: "all",
  sortMode: "uploaded-desc"
};

function isSourceFilter(value: unknown): value is SourceFilter {
  return value === "all" || value === "remote" || value === "local";
}

function isUsageFilter(value: unknown): value is UsageFilter {
  return value === "all" || value === "used" || value === "unused";
}

function isDimensionFilter(value: unknown): value is DimensionFilter {
  return value === "all" || evaluationConfig.some((dimension) => dimension.key === value);
}

function isSortMode(value: unknown): value is SortMode {
  return value === "uploaded-desc" || value === "used-desc" || value === "size-desc";
}

function isRemoteImage(image: ImageAsset): boolean {
  return /^https?:\/\//i.test(image.originalUrl);
}

function UploadFallbackButton({ className }: { className: string }) {
  return (
    <Button className={className} disabled>
      上传组件加载中
    </Button>
  );
}

export default function ImageLibraryPage() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "remote">("local");
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(DEFAULT_FILTERS.sourceFilter);
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilter>(DEFAULT_FILTERS.dimensionFilter);
  const [usageFilter, setUsageFilter] = useState<UsageFilter>(DEFAULT_FILTERS.usageFilter);
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_FILTERS.sortMode);

  const hasActiveFilters =
    sourceFilter !== DEFAULT_FILTERS.sourceFilter ||
    dimensionFilter !== DEFAULT_FILTERS.dimensionFilter ||
    usageFilter !== DEFAULT_FILTERS.usageFilter ||
    sortMode !== DEFAULT_FILTERS.sortMode;

  const filteredImages = useMemo(
    () =>
      images
        .filter((image) => {
          if (sourceFilter === "remote" && !isRemoteImage(image)) {
            return false;
          }

          if (sourceFilter === "local" && isRemoteImage(image)) {
            return false;
          }

          if (dimensionFilter !== "all" && image.lastUsedDimensionKey !== dimensionFilter) {
            return false;
          }

          if (usageFilter === "used" && !image.usedCount) {
            return false;
          }

          if (usageFilter === "unused" && image.usedCount) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          if (sortMode === "used-desc") {
            return (right.recentUsedAt ?? 0) - (left.recentUsedAt ?? 0) || right.usedCount - left.usedCount;
          }

          if (sortMode === "size-desc") {
            return (right.size ?? 0) - (left.size ?? 0) || right.uploadedAt - left.uploadedAt;
          }

          return right.uploadedAt - left.uploadedAt;
        }),
    [dimensionFilter, images, sortMode, sourceFilter, usageFilter]
  );

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

  useEffect(() => {
    try {
      const saved = Taro.getStorageSync<ImageLibraryFilters>(FILTER_STORAGE_KEY);
      if (!saved) {
        return;
      }

      if (isSourceFilter(saved.sourceFilter)) {
        setSourceFilter(saved.sourceFilter);
      }

      if (isDimensionFilter(saved.dimensionFilter)) {
        setDimensionFilter(saved.dimensionFilter);
      }

      if (isUsageFilter(saved.usageFilter)) {
        setUsageFilter(saved.usageFilter);
      }

      if (isSortMode(saved.sortMode)) {
        setSortMode(saved.sortMode);
      }
    } catch {
      // Ignore invalid local filter cache.
    }
  }, []);

  useEffect(() => {
    try {
      Taro.setStorageSync(FILTER_STORAGE_KEY, {
        sourceFilter,
        dimensionFilter,
        usageFilter,
        sortMode
      } satisfies ImageLibraryFilters);
    } catch {
      // Filter persistence is best-effort.
    }
  }, [dimensionFilter, sortMode, sourceFilter, usageFilter]);

  const handleUploaded = (_nextImages: ProofImage[]) => {
    void loadImages();
  };

  const handlePreview = async (image: ImageAsset) => {
    await Taro.previewImage({
      urls: filteredImages.map((candidate) => candidate.originalUrl),
      current: image.originalUrl
    });
  };

  const handleResetFilters = () => {
    setSourceFilter(DEFAULT_FILTERS.sourceFilter);
    setDimensionFilter(DEFAULT_FILTERS.dimensionFilter);
    setUsageFilter(DEFAULT_FILTERS.usageFilter);
    setSortMode(DEFAULT_FILTERS.sortMode);
    try {
      Taro.removeStorageSync(FILTER_STORAGE_KEY);
    } catch {
      // Ignore filter cache cleanup failures.
    }
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
        <View className="image-library__hero-copy">
          <Text className="image-library__label">图片与附件库</Text>
          <Text className="image-library__title">{userId}</Text>
          <Text className="image-library__sub">集中查看证明图片，上传后可在后续材料中复用。</Text>
        </View>
        <Button className="image-library__back" onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}>
          评定页
        </Button>
      </View>

      <View className="image-library__tools">
        <Suspense fallback={<UploadFallbackButton className="image-library__upload" />}>
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
        </Suspense>
        <FeedbackButton className="image-library__refresh" loadingText="刷新中" onClick={loadImages}>
          刷新
        </FeedbackButton>
      </View>

      <View className="image-library__status">
        <Text>{source === "remote" ? "远端图片" : "本地图片"}</Text>
        <Text>
          {filteredImages.length} / {images.length} 张
        </Text>
      </View>

      <View className="image-library__filters">
        <View className="image-library__filter-group">
          <Text className="image-library__filter-label">来源</Text>
          <View className="image-library__filter-options">
            {[
              ["all", "全部"],
              ["remote", "远端"],
              ["local", "本地"]
            ].map(([value, label]) => (
              <Button
                key={value}
                className={`image-library__filter ${sourceFilter === value ? "image-library__filter--active" : ""}`}
                onClick={() => setSourceFilter(value as SourceFilter)}
              >
                {label}
              </Button>
            ))}
          </View>
        </View>

        <View className="image-library__filter-group">
          <Text className="image-library__filter-label">维度</Text>
          <View className="image-library__filter-options image-library__filter-options--scroll">
            <Button
              className={`image-library__filter ${dimensionFilter === "all" ? "image-library__filter--active" : ""}`}
              onClick={() => setDimensionFilter("all")}
            >
              全部
            </Button>
            {evaluationConfig.map((dimension) => (
              <Button
                key={dimension.key}
                className={`image-library__filter ${
                  dimensionFilter === dimension.key ? "image-library__filter--active" : ""
                }`}
                onClick={() => setDimensionFilter(dimension.key)}
              >
                {dimension.title}
              </Button>
            ))}
          </View>
        </View>

        <View className="image-library__filter-group">
          <Text className="image-library__filter-label">状态</Text>
          <View className="image-library__filter-options">
            {[
              ["all", "全部"],
              ["used", "已引用"],
              ["unused", "未引用"]
            ].map(([value, label]) => (
              <Button
                key={value}
                className={`image-library__filter ${usageFilter === value ? "image-library__filter--active" : ""}`}
                onClick={() => setUsageFilter(value as UsageFilter)}
              >
                {label}
              </Button>
            ))}
          </View>
        </View>

        <View className="image-library__filter-group">
          <Text className="image-library__filter-label">排序</Text>
          <View className="image-library__filter-options">
            {[
              ["uploaded-desc", "最新"],
              ["used-desc", "最近使用"],
              ["size-desc", "大图"]
            ].map(([value, label]) => (
              <Button
                key={value}
                className={`image-library__filter ${sortMode === value ? "image-library__filter--active" : ""}`}
                onClick={() => setSortMode(value as SortMode)}
              >
                {label}
              </Button>
            ))}
          </View>
        </View>

        <View className="image-library__filter-actions">
          <Button
            className="image-library__filter-reset"
            disabled={!hasActiveFilters}
            onClick={handleResetFilters}
          >
            重置筛选
          </Button>
        </View>
      </View>

      {error ? <StatusBanner tone="danger" title="图片同步失败" description={error} /> : null}

      {images.length === 0 ? (
        <View className="image-library__empty-upload">
          <EmptyState
            title={loading ? "正在读取图片库" : "还没有图片"}
            description="上传证明照片后，这里会形成个人附件库。"
          />
          {!loading ? (
            <Suspense fallback={<UploadFallbackButton className="image-library__empty-upload-button" />}>
              <UploadImageButton
                multiple
                remaining={9}
                strategy="upload"
                variant="toolbar"
                className="image-library__empty-upload-button"
                onUploaded={handleUploaded}
              >
                上传图片
              </UploadImageButton>
            </Suspense>
          ) : null}
        </View>
      ) : filteredImages.length === 0 ? (
        <EmptyState title="没有符合筛选的图片" description="调整来源、维度或引用状态后再查看。" />
      ) : (
        <Suspense fallback={<EmptyState title="正在加载图片网格" description="图片较多时会稍后呈现。" />}>
          <ImageLibraryGrid images={filteredImages} onPreview={handlePreview} />
        </Suspense>
      )}
    </View>
  );
}
