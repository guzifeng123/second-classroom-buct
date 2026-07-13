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
    itemId: overrides.itemId ?? "student-code",
    text: overrides.text ?? "证明材料",
    images: overrides.images ?? [],
    selectedOption: overrides.selectedOption,
    numericValue: overrides.numericValue,
    createdAt: 1,
    updatedAt: 1,
    dirty: false
  };
}

function findIssue(issues, type, itemId) {
  return issues.find((issue) => issue.type === type && issue.itemId === itemId);
}

const { makeRecordKey } = loadTsModule(path.join(projectRoot, "src", "utils", "evaluationScoring.ts"));
const { getEvaluationValidationIssues } = loadTsModule(
  path.join(projectRoot, "src", "utils", "evaluationValidation.ts")
);
const { buildIssueFocusUrl, getIssueFocusField } = loadTsModule(
  path.join(projectRoot, "src", "utils", "evaluationIssueFocus.ts")
);

const studentCodeKey = makeRecordKey("moral", "student-code");
const moralActivityKey = makeRecordKey("moral", "moral-activity");
const laborHoursKey = makeRecordKey("labor", "labor-hours");
const competitionKey = makeRecordKey("academic", "competition");

const emptySelectedIssues = getEvaluationValidationIssues(
  {
    [moralActivityKey]: []
  },
  [moralActivityKey]
);
assertEqual(emptySelectedIssues.length, 1, "已选但没有记录时应产生一个问题");
assertEqual(emptySelectedIssues[0].type, "empty_selected_item", "已选但没有记录应标记 empty_selected_item");
assertEqual(emptySelectedIssues[0].itemId, "moral-activity", "问题应保留条目 ID");

const emptyMaterialIssues = getEvaluationValidationIssues(
  {
    [studentCodeKey]: [createRecord({ id: "record_empty", text: "  ", images: [], numericValue: undefined })]
  },
  [studentCodeKey]
);
assert(findIssue(emptyMaterialIssues, "empty_selected_item", "student-code"), "已选空记录应提示补充材料");

const missingTextIssues = getEvaluationValidationIssues(
  {
    [competitionKey]: [
      createRecord({
        id: "record_missing_text",
        dimensionKey: "academic",
        sectionKey: "base",
        itemId: "competition",
        text: " ",
        selectedOption: "school",
        images: [{ id: "img_uploaded", url: "https://example.com/a.jpg", uploaded: true }]
      })
    ]
  },
  [competitionKey]
);
const missingTextIssue = findIssue(missingTextIssues, "missing_text", "competition");
assert(missingTextIssue, "有图片但缺文字时应提示 missing_text");
assertEqual(missingTextIssue.recordId, "record_missing_text", "缺文字问题应携带 recordId");
assertEqual(missingTextIssue.recordIndex, 1, "缺文字问题应携带记录序号");
assertEqual(getIssueFocusField(missingTextIssue), "text", "缺文字问题应定位到文字字段");

const invalidNumberIssues = getEvaluationValidationIssues(
  {
    [laborHoursKey]: [
      createRecord({
        id: "record_invalid_number",
        dimensionKey: "labor",
        sectionKey: "base",
        itemId: "labor-hours",
        text: "劳动实践",
        numericValue: -1
      })
    ]
  },
  [laborHoursKey]
);
assert(findIssue(invalidNumberIssues, "invalid_number", "labor-hours"), "负数数值应提示 invalid_number");

const localImageIssues = getEvaluationValidationIssues(
  {
    [studentCodeKey]: [
      createRecord({
        id: "record_local_image",
        text: "行为准则证明",
        images: [
          { id: "img_uploaded", url: "https://example.com/a.jpg", uploaded: true },
          { id: "img_local", url: "tmp://local.jpg", uploaded: false }
        ]
      })
    ]
  },
  [studentCodeKey]
);
const localImageIssue = findIssue(localImageIssues, "local_image", "student-code");
assert(localImageIssue, "未上传本地图片应提示 local_image");
assertEqual(localImageIssue.imageIndex, 1, "本地图片问题应携带图片序号");
assertEqual(getIssueFocusField(localImageIssue), "upload", "本地图片问题应定位到上传区域");
const localImageFocusUrl = buildIssueFocusUrl(localImageIssue);
assert(localImageFocusUrl.includes("focusField=upload"), "本地图片定位 URL 应携带上传字段");
assert(localImageFocusUrl.includes("focusUpload=1"), "本地图片定位 URL 应高亮上传区域");
assert(localImageFocusUrl.includes("focusImageIndex=1"), "本地图片定位 URL 应携带图片序号");

const validIssues = getEvaluationValidationIssues(
  {
    [studentCodeKey]: [
      createRecord({
        id: "record_valid",
        text: "行为准则证明",
        images: [{ id: "img_uploaded", url: "https://example.com/a.jpg", uploaded: true }]
      })
    ],
    [laborHoursKey]: [
      createRecord({
        id: "record_valid_number",
        dimensionKey: "labor",
        sectionKey: "base",
        itemId: "labor-hours",
        text: "劳动 8 小时",
        numericValue: 8
      })
    ]
  },
  [studentCodeKey, laborHoursKey]
);
assertEqual(validIssues.length, 0, "完整有效材料不应产生提交前校验问题");

console.log("提交前校验测试通过。");
