import { useMemo } from "react";
import { Button, Image, Input, Picker, Text, Textarea, View } from "@tarojs/components";
import UploadImageButton from "../UploadImageButton";
import TransferButton from "../TransferButton";
import { calculateRecordScore } from "../../stores/useEvaluationStore";
import { useEvaluationStore } from "../../stores/useEvaluationStore";
import { useTransferStore } from "../../stores/useTransferStore";
import type { EvaluationItemConfig, ProofImage, ProofRecord } from "../../types/evaluation";
import type { EditingItemPayload } from "../../types/transfer";
import "./index.scss";

interface ProofItemProps {
  item: EvaluationItemConfig;
  record: ProofRecord;
  recordIndex: number;
  canRemove: boolean;
  showHeader?: boolean;
}

function buildPayload(record: ProofRecord): EditingItemPayload {
  return {
    dimensionKey: record.dimensionKey,
    sectionKey: record.sectionKey,
    itemId: record.itemId,
    recordId: record.id,
    text: record.text,
    images: record.images,
    selectedOption: record.selectedOption,
    numericValue: record.numericValue
  };
}

export default function ProofItem({
  item,
  record,
  recordIndex,
  canRemove,
  showHeader = true
}: ProofItemProps) {
  const updateText = useEvaluationStore((state) => state.updateText);
  const updateOption = useEvaluationStore((state) => state.updateOption);
  const updateNumber = useEvaluationStore((state) => state.updateNumber);
  const addImages = useEvaluationStore((state) => state.addImages);
  const removeImage = useEvaluationStore((state) => state.removeImage);
  const removeRecord = useEvaluationStore((state) => state.removeRecord);
  const setEditingItem = useTransferStore((state) => state.setEditingItem);

  const currentScore = calculateRecordScore(record, item);
  const selectedOptionIndex = useMemo(() => {
    const index = item.options?.findIndex((option) => option.value === record.selectedOption) ?? 0;
    return Math.max(index, 0);
  }, [item.options, record.selectedOption]);
  const transferPayload = buildPayload(record);
  const canTransfer = record.text.trim().length > 0 || record.images.length > 0;
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

  return (
    <View className={`proof-item ${showHeader ? "" : "proof-item--inline"}`}>
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
        <Picker
          mode="selector"
          range={item.options.map((option) => option.label)}
          value={selectedOptionIndex}
          onChange={(event) => handleOptionChange(Number(event.detail.value))}
        >
          <View className="proof-item__select">
            <Text>{item.options[selectedOptionIndex]?.label ?? "请选择"}</Text>
            <Text className="proof-item__select-arrow">⌄</Text>
          </View>
        </Picker>
      ) : null}

      {item.scoreType === "number" || item.scoreType === "deduction" ? (
        <View className="proof-item__number-row">
          <Input
            className="proof-item__number"
            type="number"
            value={record.numericValue === undefined ? "" : String(record.numericValue)}
            placeholder={`填写${item.unitLabel ?? "数值"}`}
            onInput={(event) => handleNumberChange(event.detail.value)}
          />
          <Text className="proof-item__unit">{item.unitLabel ?? "项"}</Text>
        </View>
      ) : null}

      <Textarea
        className="proof-item__textarea"
        value={record.text}
        maxlength={800}
        autoHeight
        placeholder={item.placeholder}
        onInput={(event) => handleTextChange(event.detail.value)}
      />

      <View className="proof-item__images">
        {record.images.map((image) => (
          <View className="proof-item__image-wrap" key={image.id}>
            <Image className="proof-item__image" src={image.thumbUrl ?? image.url} mode="aspectFill" />
            <Button
              className="proof-item__image-remove"
              onClick={() => removeImage(record.dimensionKey, record.itemId, record.id, image.id)}
            >
              ×
            </Button>
          </View>
        ))}
        <UploadImageButton
          variant="compact"
          disabled={remainingImages <= 0}
          remaining={remainingImages}
          onUploaded={handleImages}
        />
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
