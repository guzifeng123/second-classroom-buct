import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Input, Text, View } from "@tarojs/components";
import { EmptyState, FeedbackButton, StatusBanner } from "../../../components/ui";
import { fetchNotes, type NoteSummary } from "../../../services/noteService";
import { useNoteStore } from "../../../stores/useNoteStore";
import { useUserStore } from "../../../stores/useUserStore";
import "./index.scss";

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

export default function NoteListPage() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const resetNote = useNoteStore((state) => state.reset);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "remote">("local");
  const [error, setError] = useState("");

  const loadNotes = async (keyword = query) => {
    setLoading(true);
    try {
      const result = await fetchNotes(keyword);
      setNotes(result.data);
      setSource(result.source);
      setError(result.error ?? "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "图文材料读取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes("");
  }, []);

  const handleSearch = () => {
    void loadNotes(query);
  };

  const handleNew = async () => {
    resetNote();
    await Taro.navigateTo({
      url: "/pages/note/edit/index"
    });
  };

  const handleEdit = async (noteId: string) => {
    await Taro.navigateTo({
      url: `/pages/note/edit/index?noteId=${encodeURIComponent(noteId)}`
    });
  };

  const handleBackEvaluation = async () => {
    await Taro.redirectTo({
      url: "/pages/evaluation/index"
    });
  };

  if (!isLoggedIn) {
    return (
      <View className="page-shell note-list note-list--gate">
        <Text className="note-list__gate-title">未登录</Text>
        <Button className="note-list__gate-button" onClick={() => Taro.redirectTo({ url: "/pages/login/index" })}>
          返回登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-shell note-list">
      <View className="note-list__hero">
        <View className="note-list__hero-copy">
          <Text className="note-list__label">图文材料库</Text>
          <Text className="note-list__title">{userId}</Text>
          <Text className="note-list__sub">统一管理已保存的图文证明，继续编辑或新建材料。</Text>
        </View>
        <Button className="note-list__back" onClick={handleBackEvaluation}>
          评定页
        </Button>
      </View>

      <View className="note-list__tools">
        <Input
          className="note-list__search"
          value={query}
          placeholder="搜索标题或正文"
          onInput={(event) => setQuery(event.detail.value)}
          onConfirm={handleSearch}
        />
        <FeedbackButton className="note-list__tool-button" loadingText="搜索中" onClick={handleSearch}>
          搜索
        </FeedbackButton>
        <FeedbackButton className="note-list__primary" loadingText="打开中" onClick={handleNew}>
          新建
        </FeedbackButton>
      </View>

      <View className="note-list__status">
        <Text>{source === "remote" ? "远端材料" : "本地材料"}</Text>
        <Text>{notes.length} 条</Text>
      </View>

      {error ? <StatusBanner tone="danger" title="材料同步失败" description={error} /> : null}

      {notes.length === 0 ? (
        <EmptyState
          title={loading ? "正在读取图文材料" : "还没有图文材料"}
          description="新建一份材料，把活动说明、过程照片和证明信息集中保存。"
          action={
            <FeedbackButton className="note-list__empty-button" loadingText="打开中" onClick={handleNew}>
              新建图文材料
            </FeedbackButton>
          }
        />
      ) : (
        <View className="note-list__grid">
          {notes.map((note) => (
            <View className="note-list__card" key={note.id}>
              <View className="note-list__card-main">
                <Text className="note-list__card-title">{note.title}</Text>
                <Text className="note-list__card-copy">{note.plainText || "暂无正文内容"}</Text>
              </View>
              <View className="note-list__card-meta">
                <Text>{note.blockCount} 块内容</Text>
                <Text>{note.imageCount} 张图片</Text>
                <Text>{formatTime(note.updatedAt)}</Text>
              </View>
              <Button className="note-list__card-button" onClick={() => handleEdit(note.id)}>
                继续编辑
              </Button>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
