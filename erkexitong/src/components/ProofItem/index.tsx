import { useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Input, Text, Textarea, View } from "@tarojs/components";
import UploadImageButton from "../UploadImageButton";
import TransferButton from "../TransferButton";
import { fetchImages, imageAssetToProofImage, markImageAssetUsed } from "../../services/imageLibraryService";
import { persistNoteSnapshotPreview } from "../../services/noteSnapshotService";
import { fetchNoteDetail, fetchNotes, type NoteDetail, type NoteSummary } from "../../services/noteService";
import { calculateRecordScore } from "../../stores/useEvaluationStore";
import { useEvaluationStore } from "../../stores/useEvaluationStore";
import { useTransferStore } from "../../stores/useTransferStore";
import type {
  EvaluationFocusField,
  EvaluationItemConfig,
  NoteReference,
  ProofImage,
  ProofRecord
} from "../../types/evaluation";
import type { EditingItemPayload } from "../../types/transfer";
import { openDetailRouteOnce } from "../../utils/detailNavigation";
import "./index.scss";

interface ProofItemProps {
  item: EvaluationItemConfig;
  record: ProofRecord;
  recordIndex: number;
  canRemove: boolean;
  showHeader?: boolean;
  focused?: boolean;
  focusUpload?: boolean;
  focusField?: EvaluationFocusField;
  focusImageIndex?: number;
}

function buildPayload(record: ProofRecord): EditingItemPayload {
  return {
    dimensionKey: record.dimensionKey,
    sectionKey: record.sectionKey,
    itemId: record.itemId,
    recordId: record.id,
    text: record.text,
    images: record.images,
    noteReferences: record.noteReferences,
    selectedOption: record.selectedOption,
    numericValue: record.numericValue
  };
}

function buildNoteReference(note: NoteDetail | NoteSummary): NoteReference {
  return {
    noteId: note.id,
    title: note.title,
    plainText: note.plainText,
    imageCount: note.imageCount,
    referencedAt: Date.now(),
    contentSnapshot: "content" in note ? note.content : undefined
  };
}

function buildTextWithNoteReference(text: string, note: NoteSummary): string {
  const summary = note.plainText ? `：${note.plainText.slice(0, 120)}` : "";
  const nextLine = `引用图文材料《${note.title}》${summary}`;
  return text.trim() ? `${text.trim()}\n${nextLine}` : nextLine;
}

export default function ProofItem({
  item,
  record,
  recordIndex,
  canRemove,
  showHeader = true,
  focused = false,
  focusUpload = false,
  focusField,
  focusImageIndex
}: ProofItemProps) {
  const updateText = useEvaluationStore((state) => state.updateText);
  const updateOption = useEvaluationStore((state) => state.updateOption);
  const updateNumber = useEvaluationStore((state) => state.updateNumber);
  const addImages = useEvaluationStore((state) => state.addImages);
  const replaceImage = useEvaluationStore((state) => state.replaceImage);
  const removeImage = useEvaluationStore((state) => state.removeImage);
  const addNoteReference = useEvaluationStore((state) => state.addNoteReference);
  const removeNoteReference = useEvaluationStore((state) => state.removeNoteReference);
  const removeRecord = useEvaluationStore((state) => state.removeRecord);
  const setEditingItem = useTransferStore((state) => state.setEditingItem);
  const [optionOpen, setOptionOpen] = useState(false);
  const [unavailableNoteIds, setUnavailableNoteIds] = useState<string[]>([]);

  const currentScore = calculateRecordScore(record, item);
  const selectedOptionIndex = useMemo(() => {
    const index = item.options?.findIndex((option) => option.value === record.selectedOption) ?? 0;
    return Math.max(index, 0);
  }, [item.options, record.selectedOption]);
  const transferPayload = buildPayload(record);
  const canTransfer = record.text.trim().length > 0 || record.images.length > 0 || (record.noteReferences?.length ?? 0) > 0;
  const remainingImages = Math.max(item.imageLimit - record.images.length, 0);

  const syncEditing = (nextRecord: ProofRecord) => {
    setEditingItem(buildPayload(nextRecord));
  };

  const handleTextChange = (value: string) => {
    const nextRecord = {
      ...record,
      text: value
    };
    updateText(record.dimensionKey, record.itemId, record.id, value);
    syncEditing(nextRecord);
  };

  const handleOptionChange = (index: number) => {
    const option = item.options?.[index];
    if (!option) {
      return;
    }

    const nextRecord = {
      ...record,
      selectedOption: option.value
    };
    updateOption(record.dimensionKey, record.itemId, record.id, option.value);
    syncEditing(nextRecord);
    setOptionOpen(false);
  };

  const handleNumberChange = (value: string) => {
    const numericValue = Number(value);
    const nextRecord = {
      ...record,
      numericValue: Number.isFinite(numericValue) ? numericValue : 0
    };
    updateNumber(record.dimensionKey, record.itemId, record.id, nextRecord.numericValue);
    syncEditing(nextRecord);
  };

  const handleImages = (images: ProofImage[]) => {
    const nextImages = [...record.images, ...images].slice(0, item.imageLimit);
    const nextRecord = {
      ...record,
      images: nextImages
    };
    addImages(record.dimensionKey, record.itemId, record.id, images);
    syncEditing(nextRecord);
  };

  const handleReplaceImage = async (targetImage: ProofImage, images: ProofImage[]) => {
    const replacement = images[0];
    if (!replacement) {
      return;
    }

    const nextImages = record.images.map((image) => (image.id === targetImage.id ? replacement : image));
    const nextRecord = {
      ...record,
      images: nextImages
    };
    replaceImage(record.dimensionKey, record.itemId, record.id, targetImage.id, replacement);
    syncEditing(nextRecord);

    const result = await Taro.showModal({
      title: "失败图片已替换",
      content: "已替换失败图片，是否立即重新提交当前评定？",
      confirmText: "立即提交",
      cancelText: "稍后提交"
    });

    if (result.confirm) {
      await Taro.redirectTo({
        url: "/pages/evaluation/index?submit=1"
      });
      return;
    }

    await Taro.showToast({
      title: "已替换，请稍后提交",
      icon: "success"
    });
  };

  const handleChooseFromLibrary = async () => {
    if (remainingImages <= 0) {
      await Taro.showToast({
        title: "图片数量已达上限",
        icon: "none"
      });
      return;
    }

    try {
      const result = await fetchImages(0, 12);
      const reusableImages = result.data.filter((image) =>
        record.images.every((existingImage) => existingImage.id !== image.id)
      );

      if (reusableImages.length === 0) {
        await Taro.showToast({
          title: "图片库暂无可复用图片",
          icon: "none"
        });
        return;
      }

      const visibleImages = reusableImages.slice(0, 6);
      const actionResult = await Taro.showActionSheet({
        itemList: visibleImages.map((image, index) => `图片 ${index + 1} · ${image.id.slice(0, 12)}`)
      });
      const selectedImage = visibleImages[actionResult.tapIndex];

      if (selectedImage) {
        handleImages([imageAssetToProofImage(selectedImage)]);
        await markImageAssetUsed(selectedImage.id, {
          dimensionKey: record.dimensionKey,
          sectionKey: record.sectionKey,
          itemId: record.itemId
        });
        await Taro.showToast({
          title: "已引用图片库图片",
          icon: "success"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片库读取失败";
      if (!message.includes("cancel")) {
        await Taro.showToast({
          title: message,
          icon: "none"
        });
      }
    }
  };

  const handleChooseNote = async () => {
    try {
      const result = await fetchNotes("");
      const reusableNotes = result.data.filter((note) =>
        (record.noteReferences ?? []).every((reference) => reference.noteId !== note.id)
      );

      if (reusableNotes.length === 0) {
        await Taro.showToast({
          title: "暂无可引用图文",
          icon: "none"
        });
        return;
      }

      const visibleNotes = reusableNotes.slice(0, 6);
      const actionResult = await Taro.showActionSheet({
        itemList: visibleNotes.map((note) => note.title.slice(0, 18) || "未命名图文材料")
      });
      const selectedNote = visibleNotes[actionResult.tapIndex];

      if (selectedNote) {
        let snapshotNote: NoteDetail | NoteSummary = selectedNote;

        try {
          snapshotNote = await fetchNoteDetail(selectedNote.id);
        } catch {
          // The summary is enough to keep a lightweight fallback snapshot.
        }

        const nextText = buildTextWithNoteReference(record.text, snapshotNote);
        const reference = buildNoteReference(snapshotNote);
        const nextRecord = {
          ...record,
          text: nextText,
          noteReferences: [reference, ...(record.noteReferences ?? [])].slice(0, 4)
        };

        updateText(record.dimensionKey, record.itemId, record.id, nextText);
        addNoteReference(record.dimensionKey, record.itemId, record.id, reference);
        syncEditing(nextRecord);
        await Taro.showToast({
          title: "已引用图文材料",
          icon: "success"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "图文材料读取失败";
      if (!message.includes("cancel")) {
        await Taro.showToast({
          title: message,
          icon: "none"
        });
      }
    }
  };

  const handleOpenNoteReference = async (noteId: string) => {
    try {
      await fetchNoteDetail(noteId);
      setUnavailableNoteIds((ids) => ids.filter((id) => id !== noteId));
      await openDetailRouteOnce(`/pages/note/edit/index?noteId=${encodeURIComponent(noteId)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "原图文材料暂不可打开";
      setUnavailableNoteIds((ids) => (ids.includes(noteId) ? ids : [...ids, noteId]));
      await Taro.showModal({
        title: "原图文不可用",
        content: `${message}。当前评定记录中的引用快照仍会保留。`,
        showCancel: false,
        confirmText: "知道了"
      });
    }
  };

  const handleOpenNoteSnapshot = async (reference: NoteReference) => {
    await openDetailRouteOnce(await persistNoteSnapshotPreview(reference));
  };

  const handleRemoveNoteReference = (noteId: string) => {
    const nextRecord = {
      ...record,
      noteReferences: (record.noteReferences ?? []).filter((reference) => reference.noteId !== noteId)
    };
    removeNoteReference(record.dimensionKey, record.itemId, record.id, noteId);
    setUnavailableNoteIds((ids) => ids.filter((id) => id !== noteId));
    syncEditing(nextRecord);
  };

  return (
    <View className={`proof-item ${showHeader ? "" : "proof-item--inline"} ${focused ? "proof-item--focused" : ""}`}>
      {showHeader ? (
        <View className="proof-item__head">
          <View>
            <Text className="proof-item__title">
              {item.mode === "multi" ? `记录 #${recordIndex + 1}` : item.title}
            </Text>
            <Text className="proof-item__rule">{item.description}</Text>
          </View>
          <Text className="proof-item__score">{currentScore} 分</Text>
        </View>
      ) : null}

      <View className="proof-item__meta-strip">
        <View className="proof-item__meta-copy">
          <Text className="proof-item__meta-label">计分规则</Text>
          <Text className="proof-item__meta-text">{item.description}</Text>
        </View>
        <View className="proof-item__meta-score">
          <Text className="proof-item__meta-score-value">{currentScore}</Text>
          <Text className="proof-item__meta-score-label">/{item.maxScore}</Text>
        </View>
      </View>

      {item.options ? (
        <View className="proof-item__select-wrap">
          <View
            className={`proof-item__select ${optionOpen ? "proof-item__select--open" : ""}`}
            onClick={() => setOptionOpen((value) => !value)}
          >
            <Text>{item.options[selectedOptionIndex]?.label ?? "请选择"}</Text>
            <Text className="proof-item__select-arrow">⌄</Text>
          </View>
          {optionOpen ? (
            <View className="proof-item__select-menu">
              {item.options.map((option, index) => (
                <Button
                  className={`proof-item__select-option ${
                    index === selectedOptionIndex ? "proof-item__select-option--active" : ""
                  }`}
                  key={option.value}
                  onClick={() => handleOptionChange(index)}
                >
                  <Text className="proof-item__select-option-label">{option.label}</Text>
                  <Text className="proof-item__select-option-score">{option.score} 分</Text>
                </Button>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {item.scoreType === "number" || item.scoreType === "deduction" ? (
        <View className={`proof-item__number-row ${focusField === "number" ? "proof-item__field--focused" : ""}`}>
          <Input
            className="proof-item__number"
            type="number"
            focus={focusField === "number"}
            value={record.numericValue === undefined ? "" : String(record.numericValue)}
            placeholder={`填写${item.unitLabel ?? "数值"}`}
            onInput={(event) => handleNumberChange(event.detail.value)}
          />
          <Text className="proof-item__unit">{item.unitLabel ?? "项"}</Text>
        </View>
      ) : null}

      <Textarea
        className={`proof-item__textarea ${focusField === "text" ? "proof-item__field--focused" : ""}`}
        value={record.text}
        maxlength={800}
        autoHeight
        focus={focusField === "text"}
        placeholder={item.placeholder}
        onInput={(event) => handleTextChange(event.detail.value)}
      />

      {record.noteReferences && record.noteReferences.length > 0 ? (
        <View className="proof-item__notes">
          {record.noteReferences.map((reference) => {
            const unavailable = unavailableNoteIds.includes(reference.noteId);

            return (
              <View
                className={`proof-item__note ${unavailable ? "proof-item__note--unavailable" : ""}`}
                key={reference.noteId}
              >
                <View className="proof-item__note-main">
                  <Text className="proof-item__note-title">《{reference.title}》</Text>
                  <Text className="proof-item__note-copy">
                    {reference.plainText || "暂无摘要"} · {reference.imageCount} 张图片
                  </Text>
                  {unavailable ? <Text className="proof-item__note-status">原材料不可用，已保留快照</Text> : null}
                </View>
                <Button
                  className="proof-item__note-open"
                  onClick={() => void handleOpenNoteReference(reference.noteId)}
                >
                  查看
                </Button>
                <Button
                  className="proof-item__note-snapshot"
                  onClick={() => void handleOpenNoteSnapshot(reference)}
                >
                  快照
                </Button>
                <Button className="proof-item__note-remove" onClick={() => handleRemoveNoteReference(reference.noteId)}>
                  移除
                </Button>
              </View>
            );
          })}
        </View>
      ) : null}

      <View className={`proof-item__images ${focusUpload ? "proof-item__images--focused" : ""}`}>
        {record.images.map((image, index) => (
          <View
            className={`proof-item__image-wrap ${
              focusUpload && focusImageIndex === index ? "proof-item__image-wrap--focused" : ""
            }`}
            key={image.id}
          >
            <Image className="proof-item__image" src={image.thumbUrl ?? image.url} mode="aspectFill" />
            <Button
              className="proof-item__image-remove"
              onClick={() => removeImage(record.dimensionKey, record.itemId, record.id, image.id)}
            >
              ×
            </Button>
            {focusUpload && focusImageIndex === index ? (
              <UploadImageButton
                className="proof-item__image-retry"
                wrapClassName="proof-item__image-retry-wrap"
                multiple={false}
                remaining={1}
                strategy="upload"
                variant="compact"
                onUploaded={(images) => {
                  void handleReplaceImage(image, images);
                }}
              >
                重传
              </UploadImageButton>
            ) : null}
          </View>
        ))}
        <UploadImageButton
          variant="compact"
          disabled={remainingImages <= 0}
          remaining={remainingImages}
          onUploaded={handleImages}
        />
        <Button
          className="proof-item__library"
          disabled={remainingImages <= 0}
          onClick={() => void handleChooseFromLibrary()}
        >
          图片库
        </Button>
        <Button className="proof-item__library proof-item__library--note" onClick={() => void handleChooseNote()}>
          图文库
        </Button>
      </View>

      <View className="proof-item__actions">
        <TransferButton payload={transferPayload} disabled={!canTransfer} variant="compact" />
        {canRemove ? (
          <Button
            className="proof-item__delete"
            onClick={() => removeRecord(record.dimensionKey, record.itemId, record.id)}
          >
            删除
          </Button>
        ) : null}
      </View>
    </View>
  );
}
