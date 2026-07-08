import { useEffect, useMemo, useRef, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Image, Input, ScrollView, Text, Textarea, View } from "@tarojs/components";
import NoteContentRenderer from "../../../components/NoteContentRenderer";
import UploadImageButton from "../../../components/UploadImageButton";
import { initTransferSync, promptApplyIncomingTransfer, sendTransferTo } from "../../../services/transferService";
import { useConnectionStore } from "../../../stores/useConnectionStore";
import { useNoteStore } from "../../../stores/useNoteStore";
import { useTransferStore } from "../../../stores/useTransferStore";
import { useUserStore } from "../../../stores/useUserStore";
import type { ProofImage } from "../../../types/evaluation";
import type { ContentBlock } from "../../../types/content";
import type { NoteTransferPayload } from "../../../types/transfer";
import "./index.scss";

function blockHasContent(block: ContentBlock): boolean {
  if (block.type === "image") {
    return Boolean(block.url);
  }

  if ("text" in block) {
    return block.text.trim().length > 0;
  }

  return Object.keys(block.data).length > 0;
}

export default function NoteEditPage() {
  const router = useRouter();
  const promptLockRef = useRef(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [pageError, setPageError] = useState("");
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const deviceName = useUserStore((state) => state.deviceName);
  const isConnected = useConnectionStore((state) => state.isConnected);
  const otherDevices = useConnectionStore((state) => state.otherDevices);
  const noteId = useNoteStore((state) => state.noteId);
  const title = useNoteStore((state) => state.title);
  const content = useNoteStore((state) => state.content);
  const savedAt = useNoteStore((state) => state.savedAt);
  const hydrated = useNoteStore((state) => state.hydrated);
  const isDirty = useNoteStore((state) => state.isDirty);
  const hydrateFromStorage = useNoteStore((state) => state.hydrateFromStorage);
  const loadNote = useNoteStore((state) => state.loadNote);
  const setTitle = useNoteStore((state) => state.setTitle);
  const setContent = useNoteStore((state) => state.setContent);
  const addBlock = useNoteStore((state) => state.addBlock);
  const updateBlock = useNoteStore((state) => state.updateBlock);
  const removeBlock = useNoteStore((state) => state.removeBlock);
  const saveNote = useNoteStore((state) => state.saveNote);
  const reset = useNoteStore((state) => state.reset);
  const incomingTransfer = useTransferStore((state) => state.incomingTransfer);
  const clearIncoming = useTransferStore((state) => state.clearIncoming);
  const onlineDevices = otherDevices.filter((device) => device.online && device.deviceId !== "broadcast");
  const hasContent = useMemo(() => content.some(blockHasContent), [content]);

  useEffect(() => {
    if (!hydrated) {
      void hydrateFromStorage();
    }
  }, [hydrated, hydrateFromStorage]);

  useEffect(() => {
    const routeNoteId = router.params.noteId;
    if (!routeNoteId || routeNoteId === noteId || loadingNote) {
      return;
    }

    setLoadingNote(true);
    setPageError("");
    loadNote(routeNoteId)
      .catch((error) => {
        setPageError(error instanceof Error ? error.message : "图文材料读取失败");
      })
      .finally(() => {
        setLoadingNote(false);
      });
  }, [loadNote, loadingNote, noteId, router.params.noteId]);

  useEffect(() => {
    if (isLoggedIn) {
      initTransferSync();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!incomingTransfer || incomingTransfer.action !== "NOTE_CONTENT" || promptLockRef.current) {
      return;
    }

    promptLockRef.current = true;
    promptApplyIncomingTransfer(incomingTransfer)
      .catch(() => {
        clearIncoming();
      })
      .finally(() => {
        promptLockRef.current = false;
      });
  }, [incomingTransfer, clearIncoming]);

  const handleGoLogin = async () => {
    await Taro.redirectTo({
      url: "/pages/login/index"
    });
  };

  const handleBackEvaluation = async () => {
    await Taro.redirectTo({
      url: "/pages/note/list/index"
    });
  };

  const handleUpload = (images: ProofImage[]) => {
    const imageBlocks: ContentBlock[] = images.map((image) => ({
      type: "image",
      url: image.url,
      thumbUrl: image.thumbUrl,
      width: image.width,
      height: image.height,
      alt: "图文材料图片"
    }));
    setContent([...content, ...imageBlocks]);
  };

  const handleSave = async () => {
    setPageError("");
    try {
      await saveNote();
      await Taro.showToast({
        title: "已保存草稿",
        icon: "success"
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleTransfer = async () => {
    if (!hasContent) {
      await Taro.showToast({
        title: "先添加内容",
        icon: "none"
      });
      return;
    }

    if (!isConnected) {
      await Taro.showToast({
        title: "离线时不能流转",
        icon: "none"
      });
      return;
    }

    const itemList = ["我的其他设备", ...onlineDevices.map((device) => device.deviceName)];

    try {
      const result = await Taro.showActionSheet({ itemList });
      const targetDevice = result.tapIndex === 0 ? "broadcast" : onlineDevices[result.tapIndex - 1]?.deviceId;
      const payload: NoteTransferPayload = {
        noteId,
        title: title.trim() || "未命名图文材料",
        content
      };

      await sendTransferTo(targetDevice || "broadcast", "NOTE_CONTENT", payload);
      await Taro.showToast({
        title: "内容已发送",
        icon: "success"
      });
    } catch {
      // User cancelled the device picker.
    }
  };

  const handleReset = async () => {
    const result = await Taro.showModal({
      title: "清空图文草稿",
      content: "清空后将移除当前标题、文字和图片",
      confirmText: "清空",
      cancelText: "取消"
    });

    if (result.confirm) {
      reset();
    }
  };

  const renderBlock = (block: ContentBlock, index: number) => {
    if (block.type === "heading") {
      return (
        <View className="note-block" key={index}>
          <View className="note-block__bar">
            <Text className="note-block__kind">标题</Text>
            <Button className="note-block__remove" onClick={() => removeBlock(index)}>
              删除
            </Button>
          </View>
          <Input
            className="note-block__input note-block__input--heading"
            value={block.text}
            maxlength={80}
            placeholder="输入小标题"
            onInput={(event) =>
              updateBlock(index, {
                ...block,
                text: event.detail.value
              })
            }
          />
        </View>
      );
    }

    if (block.type === "paragraph") {
      return (
        <View className="note-block" key={index}>
          <View className="note-block__bar">
            <Text className="note-block__kind">文字</Text>
            <Button className="note-block__remove" onClick={() => removeBlock(index)}>
              删除
            </Button>
          </View>
          <Textarea
            className="note-block__textarea"
            value={block.text}
            maxlength={2000}
            autoHeight
            placeholder="补充说明、过程记录或证明材料描述"
            onInput={(event) =>
              updateBlock(index, {
                ...block,
                text: event.detail.value
              })
            }
          />
        </View>
      );
    }

    if (block.type === "image") {
      return (
        <View className="note-block" key={index}>
          <View className="note-block__bar">
            <Text className="note-block__kind">图片</Text>
            <Button className="note-block__remove" onClick={() => removeBlock(index)}>
              删除
            </Button>
          </View>
          <Image className="note-block__image" src={block.thumbUrl ?? block.url} mode="widthFix" />
        </View>
      );
    }

    return (
      <View className="note-block" key={index}>
        <View className="note-block__bar">
          <Text className="note-block__kind">扩展</Text>
          <Button className="note-block__remove" onClick={() => removeBlock(index)}>
            删除
          </Button>
        </View>
        <Text className="note-block__other">{JSON.stringify(block.data)}</Text>
      </View>
    );
  };

  if (!isLoggedIn) {
    return (
      <View className="page-shell note-page note-page--gate">
        <Text className="note-gate__title">未登录</Text>
        <Button className="note-gate__button" onClick={handleGoLogin}>
          返回登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-shell note-page">
      <View className="note-top">
        <View>
          <Text className="note-top__label">图文材料草稿</Text>
          <Text className="note-top__user">{userId}</Text>
        </View>
        <Button className="note-top__back" onClick={handleBackEvaluation}>
          列表
        </Button>
      </View>

      <View className="note-status">
        <Text className={isConnected ? "note-status__dot--on" : "note-status__dot"} />
        <Text className="note-status__text">{isConnected ? "已连接" : "离线草稿"}</Text>
        <Text className="note-status__device">{deviceName}</Text>
      </View>

      <ScrollView className="note-scroll" scrollY>
        {loadingNote ? <Text className="note-page__notice">正在读取图文材料</Text> : null}
        {pageError ? <Text className="note-page__error">{pageError}</Text> : null}
        <View className="note-title-box">
          <Text className="note-title-box__label">标题</Text>
          <Input
            className="note-title-box__input"
            value={title}
            maxlength={80}
            placeholder="例如 德育活动图文材料"
            onInput={(event) => setTitle(event.detail.value)}
          />
        </View>

        <View className="note-toolbar">
          <Button className="note-toolbar__button" onClick={() => addBlock({ type: "heading", text: "" })}>
            添加标题
          </Button>
          <Button className="note-toolbar__button" onClick={() => addBlock({ type: "paragraph", text: "" })}>
            添加文字
          </Button>
          <UploadImageButton
            multiple
            remaining={9}
            strategy="upload"
            variant="toolbar"
            onUploaded={handleUpload}
          >
            上传图片
          </UploadImageButton>
          <Button className="note-toolbar__button" onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? "编辑" : "预览"}
          </Button>
        </View>

        {previewMode ? (
          <View className="note-preview">
            <NoteContentRenderer content={content} emptyText="暂无图文内容" />
          </View>
        ) : (
          <View className="note-editor">
            {content.length === 0 ? (
              <View className="note-editor__empty">
                <Text>暂无内容</Text>
              </View>
            ) : (
              content.map(renderBlock)
            )}
          </View>
        )}

        <View className="note-bottom-space" />
      </ScrollView>

      <View className="note-actions">
        <View className="note-actions__meta">
          <Text>{savedAt ? `保存 ${new Date(savedAt).toLocaleTimeString()}` : "尚未保存"}</Text>
          <Text>{isDirty ? "有修改" : "已同步"}</Text>
        </View>
        <View className="note-actions__buttons">
          <Button className="note-actions__ghost" onClick={handleReset}>
            清空
          </Button>
          <Button className="note-actions__secondary" onClick={handleSave}>
            保存
          </Button>
          <Button className="note-actions__primary" disabled={!hasContent || !isConnected} onClick={handleTransfer}>
            流转
          </Button>
        </View>
      </View>
    </View>
  );
}
