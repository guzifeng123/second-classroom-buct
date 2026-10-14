const path = require("node:path");
const fs = require("node:fs");
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

const {
  buildSubmissionCsv,
  buildSubmissionCsvFileName,
  buildSubmissionExportRows
} = loadTsModule(path.join(projectRoot, "src", "utils", "submissionExport.ts"));

const records = [
  {
    submissionId: "sub-001",
    userId: "student-001",
    studentName: "张三,甲",
    className: "软件 2201",
    createdAt: new Date(2026, 6, 16, 9, 5, 0).getTime(),
    ruleVersion: "2026.07.v1",
    totalScore: 88,
    materialCount: 6,
    issueCount: 1,
    reviewStatus: "returned",
    reviewComment: '材料较完整，需补充"德育活动"',
    returnReason: "图片不清晰\n请重新上传",
    reviewerName: "辅导员",
    reviewedAt: new Date(2026, 6, 16, 10, 30, 0).getTime(),
    validationIssues: [],
    records: {},
    selectedItemIds: [],
    dimensionSummaries: [
      {
        key: "moral",
        title: "道德与思想素质",
        score: 30,
        maxScore: 180,
        selectedCount: 2,
        materialCount: 2,
        issueCount: 1
      },
      {
        key: "labor",
        title: "劳动与社会实践",
        score: 20,
        maxScore: 100,
        selectedCount: 1,
        materialCount: 1,
        issueCount: 0
      }
    ]
  },
  {
    submissionId: "sub-002",
    userId: "student-002",
    createdAt: 0,
    ruleVersion: "unknown",
    totalScore: 0,
    materialCount: 0,
    issueCount: 0,
    reviewStatus: "pending",
    validationIssues: [],
    records: {},
    selectedItemIds: [],
    dimensionSummaries: []
  }
];

const rows = buildSubmissionExportRows(records);
assertEqual(rows.length, 2, "导出行数应等于记录数");
assertEqual(rows[0][1], "张三,甲", "导出行应保留学生姓名");
assertEqual(rows[0][3], "2026-07-16 09:05", "提交时间应稳定格式化");
assertEqual(rows[0][5], "退回补充", "审核状态应使用中文文案");
assertEqual(rows[0][9], "道德与思想素质:30/180；劳动与社会实践:20/100", "维度得分应保持页面口径");
assertEqual(rows[1][1], "student-002", "缺少姓名时应回退 userId");
assertEqual(rows[1][3], "", "缺少提交时间时应留空");

const csv = buildSubmissionCsv(records);
assert(csv.endsWith("\n"), "CSV 应以换行结束，便于追加和命令行查看");
assertIncludes(csv, "提交编号,学生,班级,提交时间", "CSV 应包含表头");
assertIncludes(csv, '"张三,甲"', "包含逗号的字段应加引号");
assertIncludes(csv, '"材料较完整，需补充""德育活动"""', "包含引号的字段应转义");
assertIncludes(csv, '"图片不清晰\n请重新上传"', "包含换行的字段应加引号");
assertIncludes(csv, "sub-002,student-002,,", "缺省字段应导出为空单元格");
assertEqual(
  buildSubmissionCsvFileName("submissions", new Date(2026, 6, 16, 12, 0, 0).getTime()),
  "submissions-20260716.csv",
  "导出文件名应包含日期"
);

const adminDashboardSource = fs.readFileSync(
  path.join(projectRoot, "src", "pages", "evaluation", "components", "EvaluationAdminDashboard.tsx"),
  "utf8"
);
assertIncludes(adminDashboardSource, "buildSubmissionCsv(exportRecords)", "后台导出按钮应复用统一 CSV 生成工具");
assertIncludes(adminDashboardSource, "exportTextFile(fileName", "后台导出按钮应走统一文件导出入口");
assertIncludes(adminDashboardSource, "导出CSV", "后台导出按钮应出现在审核列表操作区");
assertIncludes(adminDashboardSource, "buildDraftSubmissionRecord", "无正式提交时应可导出当前草稿口径");

const h5ExportSource = fs.readFileSync(path.join(projectRoot, "src", "utils", "fileExport.h5.ts"), "utf8");
assertIncludes(h5ExportSource, "new Blob", "H5 导出应使用 Blob 生成文件");
assertIncludes(h5ExportSource, "anchor.download = fileName", "H5 导出应触发浏览器下载");
assertIncludes(h5ExportSource, "URL.revokeObjectURL", "H5 导出后应释放对象 URL");

const fallbackExportSource = fs.readFileSync(path.join(projectRoot, "src", "utils", "fileExport.ts"), "utf8");
assertIncludes(fallbackExportSource, "Taro.setClipboardData", "非 H5 导出应使用剪贴板兜底");

console.log("提交记录 CSV 导出测试通过。");
