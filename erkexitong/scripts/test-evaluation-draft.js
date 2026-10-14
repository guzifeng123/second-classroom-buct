const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}：未找到 ${expected}`);
  }
}

function createRecord(overrides = {}) {
  return {
    id: overrides.id ?? "record_test",
    dimensionKey: overrides.dimensionKey ?? "moral",
    sectionKey: overrides.sectionKey ?? "base",
    itemId: overrides.itemId ?? "moral-activity",
    text: overrides.text ?? "参加主题班会",
    images: overrides.images ?? [],
    selectedOption: overrides.selectedOption,
    numericValue: overrides.numericValue,
    createdAt: 1,
    updatedAt: 1,
    dirty: false
  };
}

const { evaluationConfig } = loadTsModule(path.join(projectRoot, "src", "data", "evaluationConfig.ts"));
const { makeRecordKey } = loadTsModule(path.join(projectRoot, "src", "utils", "evaluationScoring.ts"));
const {
  buildEvaluationConflictMessage,
  countChangedEvaluationItems,
  createDefaultSelectedEvaluationItemIds,
  createInitialEvaluationRecords,
  evaluationSnapshotsDiffer,
  formatEvaluationSnapshotTime,
  hasMeaningfulEvaluationDraft,
  mergeSelectedEvaluationItemIds,
  normalizeEvaluationSnapshot,
  summarizeChangedEvaluationDimensions,
  summarizeChangedEvaluationItems,
  summarizeEvaluationSnapshot
} = loadTsModule(path.join(projectRoot, "src", "utils", "evaluationDraft.ts"));

const allItemKeys = evaluationConfig.flatMap((dimension) =>
  dimension.sections.flatMap((section) => section.items.map((item) => makeRecordKey(dimension.key, item.id)))
);
const defaultSelected = createDefaultSelectedEvaluationItemIds();
const initialRecords = createInitialEvaluationRecords();
const multiItemKey = makeRecordKey("moral", "moral-activity");
const singleItemKey = makeRecordKey("moral", "student-code");

assertEqual(Object.keys(initialRecords).length, allItemKeys.length, "初始记录应覆盖全部评分条目");
assert(defaultSelected.includes(singleItemKey), "单条目默认应被选中");
assert(!defaultSelected.includes(multiItemKey), "多条目默认不应被选中");
assertEqual(initialRecords[singleItemKey].length, 1, "单条目应自动生成一条空记录");
assertEqual(initialRecords[multiItemKey].length, 0, "多条目初始记录应为空");

const savedRecord = createRecord({ id: "record_saved", text: "德育活动证明" });
const normalized = normalizeEvaluationSnapshot(
  {
    records: {
      [multiItemKey]: [savedRecord]
    },
    selectedItemIds: [],
    savedAt: 123,
    source: "remote",
    draft_version: 7
  },
  "local"
);

assertEqual(normalized.source, "local", "归一化应使用显式传入的来源");
assertEqual(normalized.savedAt, 123, "归一化不应改写保存时间");
assertEqual(normalized.draftVersion, "7", "归一化应兼容后端 draft_version 草稿版本");
assertEqual(Object.keys(normalized.records).length, allItemKeys.length, "旧草稿应补齐当前全部评分条目");
assertEqual(normalized.records[multiItemKey][0].id, "record_saved", "已有草稿记录不应被默认记录覆盖");
assert(normalized.selectedItemIds.includes(multiItemKey), "有材料的条目应自动并入已选条目");

const selectedFromEmpty = mergeSelectedEvaluationItemIds(initialRecords, undefined);
assertEqual(
  selectedFromEmpty.length,
  defaultSelected.length,
  "缺少 selectedItemIds 的旧草稿应回退为默认单条目集合"
);

assertEqual(hasMeaningfulEvaluationDraft(normalized), true, "包含文字材料的草稿应被视为有效草稿");
assertEqual(
  hasMeaningfulEvaluationDraft({
    records: initialRecords,
    selectedItemIds: defaultSelected,
    savedAt: 1,
    source: "local"
  }),
  false,
  "只有默认空记录的草稿不应被视为有效草稿"
);

assertEqual(
  evaluationSnapshotsDiffer(normalized, {
    ...normalized,
    selectedItemIds: normalized.selectedItemIds
  }),
  false,
  "内容一致的草稿不应触发冲突"
);
assertEqual(
  evaluationSnapshotsDiffer(normalized, {
    ...normalized,
    selectedItemIds: normalized.selectedItemIds.filter((key) => key !== multiItemKey)
  }),
  true,
  "已选条目变化应触发冲突"
);

const localSavedAt = new Date(2026, 6, 13, 18, 5, 0).getTime();
const remoteSavedAt = new Date(2026, 6, 13, 18, 10, 0).getTime();
const localConflictSnapshot = {
  records: {
    [multiItemKey]: [savedRecord]
  },
  selectedItemIds: [multiItemKey],
  savedAt: localSavedAt,
  source: "local",
  draftVersion: "local-v2"
};
const remoteConflictSnapshot = {
  records: {
    [multiItemKey]: [
      createRecord({
        id: "record_remote",
        text: "远端德育材料",
        images: [{ id: "image_remote", url: "https://example.com/image.jpg", uploaded: true }]
      })
    ],
    [singleItemKey]: [createRecord({ id: "record_single", itemId: "student-code", text: "远端行为记录" })]
  },
  selectedItemIds: [multiItemKey, singleItemKey],
  savedAt: remoteSavedAt,
  source: "remote",
  deviceName: "辅导员办公室",
  draftVersion: "remote-v3"
};
const localConflictSummary = summarizeEvaluationSnapshot(localConflictSnapshot);
const remoteConflictSummary = summarizeEvaluationSnapshot(remoteConflictSnapshot);
const itemDiffs = summarizeChangedEvaluationItems(localConflictSnapshot, remoteConflictSnapshot);
const dimensionDiffs = summarizeChangedEvaluationDimensions(localConflictSnapshot, remoteConflictSnapshot);
const conflictMessage = buildEvaluationConflictMessage(localConflictSnapshot, remoteConflictSnapshot);

assertEqual(localConflictSummary.selectedItemCount, 1, "冲突摘要应统计本机已选条目");
assertEqual(
  summarizeEvaluationSnapshot({ ...localConflictSnapshot, selectedItemIds: undefined }).selectedItemCount,
  1,
  "旧草稿缺少已选条目时应从有效材料补齐摘要"
);
assertEqual(localConflictSummary.materialCount, 1, "冲突摘要应统计本机材料数");
assertEqual(remoteConflictSummary.materialCount, 2, "冲突摘要应统计远端材料数");
assertEqual(remoteConflictSummary.imageCount, 1, "冲突摘要应统计远端图片数");
assertEqual(countChangedEvaluationItems(localConflictSnapshot, remoteConflictSnapshot), 2, "应统计内容或选择变化的条目");
assertEqual(itemDiffs.length, 2, "条目差异摘要应列出发生变化的条目");
assertEqual(itemDiffs[0].itemTitle, "参加德育活动", "条目差异摘要应展示配置标题");
assertEqual(itemDiffs[0].selectionChanged, false, "材料内容变化不应误判为选择变化");
assertEqual(itemDiffs[0].recordsChanged, true, "材料内容变化应被标记");
assertEqual(itemDiffs[1].itemTitle, "践行学生行为准则", "条目差异摘要应展示第二个变化条目标题");
assertEqual(itemDiffs[1].selectionChanged, true, "远端新增选择应被标记");
assertEqual(itemDiffs[1].remoteSelected, true, "条目差异摘要应保留远端选择状态");
assertEqual(itemDiffs[1].remoteMaterialCount, 1, "条目差异摘要应统计远端材料数");
assertEqual(dimensionDiffs.length, 1, "维度差异摘要只应包含发生变化的维度");
assertEqual(dimensionDiffs[0].dimensionKey, "moral", "维度差异摘要应保留维度 key");
assertEqual(dimensionDiffs[0].changedItemCount, 2, "维度差异摘要应统计变化条目数");
assertEqual(dimensionDiffs[0].localMaterialCount, 1, "维度差异摘要应统计本机材料数");
assertEqual(dimensionDiffs[0].remoteMaterialCount, 2, "维度差异摘要应统计远端材料数");
assertEqual(formatEvaluationSnapshotTime(localSavedAt), "2026-07-13 18:05", "保存时间格式应稳定可读");
assertIncludes(conflictMessage, "远端 · 辅导员办公室", "冲突提示应展示可用的远端设备来源");
assertIncludes(conflictMessage, "草稿版本：本机版本 local-v2；远端版本 remote-v3", "冲突提示应展示草稿版本差异");
assertIncludes(conflictMessage, "差异涉及 2 个评定条目", "冲突提示应展示差异条目数量");
assertIncludes(conflictMessage, "差异维度：道德与思想素质 2 项", "冲突提示应展示按维度差异摘要");
assertIncludes(conflictMessage, "本机材料 1 条，远端 2 条", "冲突提示应展示维度内双方材料数量");
assertIncludes(conflictMessage, "差异条目：参加德育活动（材料变化", "冲突提示应展示逐条差异预览");
assertIncludes(conflictMessage, "践行学生行为准则（远端新增、材料变化", "冲突提示应展示条目选择变化");
assertIncludes(conflictMessage, "远端较新约 5 分钟", "冲突提示应说明版本新旧");
assertIncludes(conflictMessage, "“用远端”会覆盖本机当前草稿", "冲突提示应明确覆盖后果");

console.log("评定草稿归一化测试通过。");
