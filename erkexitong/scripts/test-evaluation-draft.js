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
  createDefaultSelectedEvaluationItemIds,
  createInitialEvaluationRecords,
  evaluationSnapshotsDiffer,
  hasMeaningfulEvaluationDraft,
  mergeSelectedEvaluationItemIds,
  normalizeEvaluationSnapshot
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
    source: "remote"
  },
  "local"
);

assertEqual(normalized.source, "local", "归一化应使用显式传入的来源");
assertEqual(normalized.savedAt, 123, "归一化不应改写保存时间");
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

console.log("评定草稿归一化测试通过。");
