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

const {
  normalizeRemoteSubmission,
  normalizeStoredSubmission,
  normalizeSubmissionList,
  parseSubmissionTime
} = loadTsModule(path.join(projectRoot, "src", "utils", "submissionNormalization.ts"));

const validationIssue = {
  type: "missing_text",
  dimensionKey: "moral",
  sectionKey: "base",
  itemId: "student-code",
  dimensionTitle: "道德与思想素质",
  itemTitle: "践行学生行为准则",
  message: "需要补充文字说明"
};
const dimensionSummary = {
  key: "moral",
  title: "道德与思想素质",
  score: 80,
  maxScore: 180,
  selectedCount: 2,
  materialCount: 1,
  issueCount: 1
};

assertEqual(parseSubmissionTime(12345), 12345, "数字时间应原样保留");
assertEqual(
  parseSubmissionTime("2026-07-09T08:00:00.000Z"),
  Date.parse("2026-07-09T08:00:00.000Z"),
  "字符串时间应解析为时间戳"
);
const fallbackStart = Date.now();
const fallbackTime = parseSubmissionTime("not-a-date");
const fallbackEnd = Date.now();
assert(fallbackTime >= fallbackStart && fallbackTime <= fallbackEnd, "非法时间应回退为当前时间");

const snakeCaseRecord = normalizeRemoteSubmission({
  submission_id: "sub_snake",
  user_id: "user_1",
  student_name: "张三",
  class_name: "软件一班",
  created_at: "2026-07-09T08:00:00.000Z",
  rule_version: "2026.07.v1",
  total_score: 88,
  material_count: 6,
  issue_count: 1,
  review_status: "returned",
  review_comment: "材料整体完整，需补一张证明照片",
  return_reason: "缺少活动现场证明图片",
  reviewer_name: "辅导员A",
  reviewed_at: "2026-07-10T08:00:00.000Z",
  validation_issues: [validationIssue],
  dimension_summaries: [dimensionSummary]
});

assertEqual(snakeCaseRecord.submissionId, "sub_snake", "蛇形 submission_id 应归一化为 submissionId");
assertEqual(snakeCaseRecord.userId, "user_1", "蛇形 user_id 应归一化为 userId");
assertEqual(snakeCaseRecord.studentName, "张三", "蛇形 student_name 应归一化为 studentName");
assertEqual(snakeCaseRecord.className, "软件一班", "蛇形 class_name 应归一化为 className");
assertEqual(snakeCaseRecord.ruleVersion, "2026.07.v1", "蛇形 rule_version 应归一化为 ruleVersion");
assertEqual(snakeCaseRecord.totalScore, 88, "蛇形 total_score 应归一化为 totalScore");
assertEqual(snakeCaseRecord.reviewStatus, "returned", "蛇形 review_status 应归一化为 reviewStatus");
assertEqual(snakeCaseRecord.reviewComment, "材料整体完整，需补一张证明照片", "蛇形 review_comment 应归一化");
assertEqual(snakeCaseRecord.returnReason, "缺少活动现场证明图片", "蛇形 return_reason 应归一化");
assertEqual(snakeCaseRecord.reviewerName, "辅导员A", "蛇形 reviewer_name 应归一化");
assertEqual(
  snakeCaseRecord.reviewedAt,
  Date.parse("2026-07-10T08:00:00.000Z"),
  "蛇形 reviewed_at 应解析为时间戳"
);
assertEqual(snakeCaseRecord.validationIssues.length, 1, "蛇形 validation_issues 应归一化为 validationIssues");
assertEqual(snakeCaseRecord.dimensionSummaries.length, 1, "蛇形 dimension_summaries 应归一化为 dimensionSummaries");
assertEqual(Object.keys(snakeCaseRecord.records).length, 0, "远端摘要默认不应伪造 records 快照");
assertEqual(snakeCaseRecord.selectedItemIds.length, 0, "远端摘要默认不应伪造 selectedItemIds");

const camelCaseRecord = normalizeRemoteSubmission({
  id: "sub_id_fallback",
  userId: "user_2",
  name: "李四",
  className: "软件二班",
  createdAt: 456,
  totalScore: 72,
  materialCount: 4,
  issueCount: 0,
  reviewComment: "审核通过",
  reviewerName: "辅导员B",
  reviewedAt: 789,
  issues: [validationIssue],
  dimensionSummaries: [dimensionSummary]
});

assertEqual(camelCaseRecord.submissionId, "sub_id_fallback", "缺少 submissionId 时应使用 id 兜底");
assertEqual(camelCaseRecord.studentName, "李四", "name 应作为 studentName 兜底");
assertEqual(camelCaseRecord.className, "软件二班", "驼峰 className 应保留");
assertEqual(camelCaseRecord.createdAt, 456, "驼峰数字 createdAt 应原样保留");
assertEqual(camelCaseRecord.ruleVersion, "unknown", "缺少规则版本时应回退为 unknown");
assertEqual(camelCaseRecord.reviewStatus, "pending", "缺少审核状态且无问题时应推断为待审核");
assertEqual(camelCaseRecord.reviewComment, "审核通过", "驼峰 reviewComment 应保留");
assertEqual(camelCaseRecord.reviewerName, "辅导员B", "驼峰 reviewerName 应保留");
assertEqual(camelCaseRecord.reviewedAt, 789, "驼峰 reviewedAt 应保留");
assertEqual(camelCaseRecord.validationIssues.length, 1, "issues 应作为 validationIssues 兜底");

const normalizedList = normalizeSubmissionList({
  data: [
    { submission_id: "sub_list_1", user_id: "user_1" },
    { user_id: "user_1" },
    { submissionId: "sub_list_2", userId: "user_1" }
  ],
  total: 3
});
assertEqual(normalizedList.length, 2, "列表归一化应过滤缺少提交 ID 的记录");
assertEqual(normalizedList[0].submissionId, "sub_list_1", "列表应保留有效蛇形记录");
assertEqual(normalizedList[1].submissionId, "sub_list_2", "列表应保留有效驼峰记录");

const storedRecord = normalizeStoredSubmission({
  submissionId: "sub_local",
  userId: "user_1",
  createdAt: 1,
  totalScore: 90,
  materialCount: 8,
  issueCount: 0
});
assertEqual(storedRecord.ruleVersion, "unknown", "本地旧提交记录应补齐规则版本");
assertEqual(storedRecord.reviewStatus, "pending", "本地旧提交记录应补齐审核状态");
assertEqual(storedRecord.validationIssues.length, 0, "本地旧提交记录应补齐 validationIssues");
assertEqual(storedRecord.dimensionSummaries.length, 0, "本地旧提交记录应补齐 dimensionSummaries");
assertEqual(storedRecord.selectedItemIds.length, 0, "本地旧提交记录应补齐 selectedItemIds");
assertEqual(Object.keys(storedRecord.records).length, 0, "本地旧提交记录应补齐 records");

const returnedStoredRecord = normalizeStoredSubmission({
  ...storedRecord,
  reviewStatus: undefined,
  issueCount: 2
});
assertEqual(returnedStoredRecord.reviewStatus, "returned", "有问题的本地旧提交记录应推断为退回补充");

console.log("提交记录接口归一化测试通过。");
