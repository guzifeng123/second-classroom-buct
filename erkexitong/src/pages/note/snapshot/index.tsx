import { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { EmptyState } from "../../../components/ui";
import NoteContentRenderer from "../../../components/NoteContentRenderer";
import type { NoteReference } from "../../../types/evaluation";
import { getNoteSnapshotContent, NOTE_SNAPSHOT_STORAGE_KEY } from "../../../utils/noteSnapshot";
import "./index.scss";

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

export default function NoteSnapshotPage() {
  const router = useRouter();
  const [reference, setReference] = useState<NoteReference | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const snapshotKey = router.params.snapshotKey
      ? decodeURIComponent(router.params.snapshotKey)
      : NOTE_SNAPSHOT_STORAGE_KEY;

    Taro.getStorage<NoteReference>({ key: snapshotKey })
      .then((result) => {
        setReference(result.data ?? null);
      })
      .catch(() => {
        setReference(null);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, [router.params.snapshotKey]);

  const handleBack = async () => {
    await Taro.navigateBack().catch(() => Taro.redirectTo({ url: "/pages/evaluation/index" }));
  };

  const content = reference ? getNoteSnapshotContent(reference) : [];

  return (
    <View className="page-shell note-snapshot-page">
      <View className="note-snapshot-page__top">
        <View className="note-snapshot-page__top-copy">
          <Text className="note-snapshot-page__label">图文材料快照</Text>
          <Text className="note-snapshot-page__title">{reference?.title ?? "快照不可用"}</Text>
          {reference ? (
            <Text className="note-snapshot-page__meta">
              图片 {reference.imageCount} 张 · 引用时间 {formatTime(reference.referencedAt)}
            </Text>
          ) : null}
        </View>
        <Button className="note-snapshot-page__back" onClick={() => void handleBack()}>
          返回
        </Button>
      </View>

      <ScrollView className="note-snapshot-page__scroll" scrollY>
        {!loaded ? <Text className="note-snapshot-page__notice">正在读取快照</Text> : null}
        {loaded && !reference ? (
          <EmptyState title="没有找到图文快照" description="请从评定记录或提交结果页重新打开快照。" />
        ) : null}
        {reference ? (
          <View className="note-snapshot-page__panel">
            <Text className="note-snapshot-page__section-title">提交时保留的内容</Text>
            <NoteContentRenderer content={content} emptyText="暂无快照内容" enableImagePreview />
            {reference.contentSnapshot && reference.contentSnapshot.length > 0 ? null : (
              <Text className="note-snapshot-page__fallback">
                当前记录只保留了摘要快照，完整内容块会在后续引用的新图文材料中保存。
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
