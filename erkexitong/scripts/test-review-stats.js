const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const { buildReviewStatsSummary } = loadTsModule(path.join(projectRoot, "src/utils/reviewStats.ts"));

const baseIssue = {
  type: "missing_text",
  dimensionKey: "moral",
  sectionKey: "base",
  itemId: "moral-1",
  dimensionTitle: "德育",
  itemTitle: "志愿服务",
  message: "请补充说明"
};

const submissions = [
  {
    submissionId: "s-1",
    userId: "u-1",
    studentName: "学生一",
    className: "一班",
    createdAt: 1784200000000,
    ruleVersion: "2026.07.v1",
    totalScore: 88,
    materialCount: 3,
    issueCount: 0,
    reviewStatus: "approved",
    validationIssues: [],
    records: {},
    selectedItemIds: [],
    dimensionSummaries: [
      { key: "moral", title: "德育", score: 18, maxScore: 20, selectedCount: 2, materialCount: 2, issueCount: 0 },
      { key: "sports", title: "体育", score: 12, maxScore: 20, selectedCount: 1, materialCount: 1, issueCount: 0 }
    ]
  },
  {
    submissionId: "s-2",
    userId: "u-2",
    studentName: "学生二",
    className: "一班",
    createdAt: 1784200100000,
    ruleVersion: "2026.07.v1",
    totalScore: 62,
    materialCount: 1,
    issueCount: 2,
    reviewStatus: "returned",
    validationIssues: [baseIssue],
    records: {},
    selectedItemIds: [],
    dimensionSummaries: [
      { key: "moral", title: "德育", score: 10, maxScore: 20, selectedCount: 1, materialCount: 1, issueCount: 1 },
      { key: "sports", title: "体育", score: 5, maxScore: 20, selectedCount: 0, materialCount: 0, issueCount: 3 }
    ]
  }
];

const rows = [
  { id: "s-1", score: 88, materialCount: 3, issueCount: 0, status: "approved" },
  { id: "s-2", score: 62, materialCount: 1, issueCount: 2, status: "returned" },
  { id: "draft-u-3", score: 20, materialCount: 0, issueCount: 4, status: "draft" },
  { id: "s-4", score: 72, materialCount: 2, issueCount: 1, status: "pending" }
];

const summary = buildReviewStatsSummary(rows, submissions);

assert.equal(summary.totalCount, 4);
assert.equal(summary.submittedCount, 3);
assert.equal(summary.pendingCount, 1);
assert.equal(summary.returnedCount, 1);
assert.equal(summary.averageScore, 61);
assert.equal(summary.submissionRate, 75);
assert.equal(summary.materialCompletionRate, 75);
assert.equal(summary.averageMaterialCount, 1.5);

assert.equal(summary.dimensionStats.length, 2);
assert.deepEqual(JSON.parse(JSON.stringify(summary.dimensionStats.find((item) => item.key === "moral"))), {
  key: "moral",
  title: "德育",
  averageScore: 14,
  maxScore: 20,
  scoreRate: 70,
  scoreGap: 6,
  materialCount: 3,
  issueCount: 1
});
assert.equal(summary.highRiskDimension.key, "sports");
assert.equal(summary.highRiskDimension.issueCount, 3);

const fallbackSummary = buildReviewStatsSummary(
  [{ id: "draft-u-1", score: 42, materialCount: 1, issueCount: 0, status: "draft" }],
  [],
  [{ key: "labor", title: "劳动", score: 8, maxScore: 10, selectedCount: 1, materialCount: 1, issueCount: 0 }]
);

assert.equal(fallbackSummary.submissionRate, 0);
assert.equal(fallbackSummary.materialCompletionRate, 100);
assert.equal(fallbackSummary.dimensionStats[0].scoreRate, 80);

console.log("review stats tests passed");
