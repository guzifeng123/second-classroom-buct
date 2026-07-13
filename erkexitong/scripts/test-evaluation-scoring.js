const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

function findItem(config, itemId) {
  for (const dimension of config) {
    for (const section of dimension.sections) {
      const item = section.items.find((candidate) => candidate.id === itemId);
      if (item) {
        return item;
      }
    }
  }
  throw new Error(`找不到评分条目 ${itemId}`);
}

function findDimension(config, dimensionKey) {
  const dimension = config.find((candidate) => candidate.key === dimensionKey);
  if (!dimension) {
    throw new Error(`找不到评分维度 ${dimensionKey}`);
  }
  return dimension;
}

function createRecord(overrides = {}) {
  return {
    id: overrides.id ?? "record_test",
    dimensionKey: overrides.dimensionKey ?? "moral",
    sectionKey: overrides.sectionKey ?? "base",
    itemId: overrides.itemId ?? "student-code",
    text: overrides.text ?? "证明材料",
    images: overrides.images ?? [],
    noteReferences: overrides.noteReferences ?? [],
    selectedOption: overrides.selectedOption,
    numericValue: overrides.numericValue,
    createdAt: 1,
    updatedAt: 1,
    dirty: false
  };
}

const { evaluationConfig } = loadTsModule(path.join(projectRoot, "src", "data", "evaluationConfig.ts"));
const {
  calculateDimensionScore,
  calculateItemScore,
  calculateRecordScore,
  hasRecordMaterial,
  makeRecordKey
} = loadTsModule(path.join(projectRoot, "src", "utils", "evaluationScoring.ts"));

const studentCode = findItem(evaluationConfig, "student-code");
const youthStudy = findItem(evaluationConfig, "youth-study");
const moralActivity = findItem(evaluationConfig, "moral-activity");
const laborHours = findItem(evaluationConfig, "labor-hours");
const moralDimension = findDimension(evaluationConfig, "moral");

assertEqual(hasRecordMaterial(createRecord({ text: "  ", numericValue: undefined })), false, "空记录不应被视为有效材料");
assertEqual(
  hasRecordMaterial(
    createRecord({
      text: "  ",
      numericValue: undefined,
      noteReferences: [
        {
          noteId: "note_test",
          title: "德育活动图文",
          plainText: "参加讲座",
          imageCount: 1,
          referencedAt: 1
        }
      ]
    })
  ),
  true,
  "图文材料引用应被视为有效材料"
);
assertEqual(calculateRecordScore(createRecord({ text: "遵守规范" }), studentCode), 40, "固定分记录应返回 fixedScore");
assertEqual(
  calculateRecordScore(createRecord({ selectedOption: "partial" }), youthStudy),
  25,
  "选项分记录应按 selectedOption 取分"
);
assertEqual(
  calculateRecordScore(createRecord({ selectedOption: "missing" }), youthStudy),
  0,
  "未知选项应按 0 分处理"
);
assertEqual(calculateRecordScore(createRecord(), moralActivity), 10, "次数分单条记录应返回 scorePerRecord");
assertEqual(
  calculateRecordScore(createRecord({ numericValue: 8 }), laborHours),
  20,
  "数值分应按 numericValue * scorePerUnit 计算"
);
assertEqual(
  calculateRecordScore(createRecord({ numericValue: -3 }), laborHours),
  0,
  "负数数值分应按 0 分处理"
);

const countRecords = Array.from({ length: 8 }, (_, index) =>
  createRecord({ id: `record_count_${index}`, itemId: "moral-activity" })
);
assertEqual(calculateItemScore(countRecords, moralActivity), 50, "条目得分不能超过条目上限");

const moralRecords = {
  [makeRecordKey("moral", "class-review")]: [createRecord({ itemId: "class-review", selectedOption: "excellent" })],
  [makeRecordKey("moral", "moral-activity")]: countRecords,
  [makeRecordKey("moral", "youth-study")]: [createRecord({ itemId: "youth-study", selectedOption: "full" })],
  [makeRecordKey("moral", "student-code")]: [createRecord({ itemId: "student-code" })],
  [makeRecordKey("moral", "moral-honor")]: [
    createRecord({ itemId: "moral-honor", sectionKey: "extension", selectedOption: "national" })
  ],
  [makeRecordKey("moral", "student-service")]: [
    createRecord({ itemId: "student-service", sectionKey: "extension", selectedOption: "excellent" })
  ]
};

assertEqual(calculateDimensionScore(moralRecords, moralDimension), 180, "维度得分应受分区与维度上限约束");

console.log("评分计分测试通过。");
