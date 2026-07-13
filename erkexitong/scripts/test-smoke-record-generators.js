const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { PAGE_MATRIX } = require("./utils/page-matrix");
const { getFlowType, readChecklistFlows, readChecklistVisualChecks } = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-records-"));
const resultFixturePath = path.join(tempDir, "results.json");
const h5TemplatePath = path.join(tempDir, "h5-results.json");
const h5FinalizeResultsPath = path.join(tempDir, "h5-finalize-results.json");
const rnTemplatePath = path.join(tempDir, "rn-results.json");
const h5FinalRecordPath = path.join(tempDir, "h5-record.md");
const rnFinalRecordPath = path.join(tempDir, "rn-record.md");
const invalidResultPath = path.join(tempDir, "invalid-results.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runScript(script, args) {
  return execFileSync(nodeBin, [script, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runScriptExpectFailure(script, args) {
  try {
    runScript(script, args);
  } catch (error) {
    return String(error.stderr ?? "") + String(error.stdout ?? "") + String(error.message ?? "");
  }

  throw new Error(`${script} 应执行失败`);
}

function assertIncludes(content, expected, label) {
  assert(content.includes(expected), `${label} 缺少：${expected}`);
}

function assertRecordCoversChecklistFlows(record, checklistFileName, label) {
  readChecklistFlows(checklistFileName).forEach((flow) => {
    assertIncludes(record, flow, label);
  });
}

function assertRecordCoversChecklistVisualChecks(record, checklistFileName, label) {
  readChecklistVisualChecks(checklistFileName).forEach((check) => {
    assertIncludes(record, check, label);
  });
}

function assertRecordCoversSmokePages(record, checklistFileName, label) {
  const flows = readChecklistFlows(checklistFileName);

  PAGE_MATRIX.filter((page) => page.smoke).forEach((page) => {
    const matchingFlows = flows.filter((flow) => flow === page.name || flow.startsWith(page.name));

    assert(matchingFlows.length > 0, `${checklistFileName} 缺少 smoke 页面流程：${page.name}`);
    assertIncludes(record, page.name, label);
    matchingFlows.forEach((flow) => {
      assertIncludes(record, `| ${flow} | ${page.type} |`, label);
    });
  });
}

function assertRecordCoversFlowTypes(record, checklistFileName, label) {
  readChecklistFlows(checklistFileName).forEach((flow) => {
    assertIncludes(record, `| ${flow} | ${getFlowType(flow)} |`, label);
  });
}

function assertResultsTemplateCoversChecklist(templateContent, checklistFileName, label) {
  const template = JSON.parse(templateContent);
  const flows = readChecklistFlows(checklistFileName);

  assert(Array.isArray(template.steps), `${label} steps 应为数组`);
  assert(template.steps.length === flows.length, `${label} steps 数量应与 checklist 流程一致`);

  flows.forEach((flow, index) => {
    const step = template.steps[index];

    assert(step.flow === flow, `${label} 第 ${index + 1} 步 flow 应与 checklist 一致`);
    assert(step.type === getFlowType(flow), `${label} 第 ${index + 1} 步 type 应与页面矩阵一致`);
    assert(step.result === "未执行", `${label} 第 ${index + 1} 步默认结果应为未执行`);
    assert(typeof step.note === "string", `${label} 第 ${index + 1} 步 note 应为字符串`);
    assert(typeof step.screenshot === "string", `${label} 第 ${index + 1} 步 screenshot 应为字符串`);
    assert(typeof step.log === "string", `${label} 第 ${index + 1} 步 log 应为字符串`);
  });
}

fs.writeFileSync(
  resultFixturePath,
  JSON.stringify({
    meta: {
      runner: "h5-smoke-runner",
      baseUrl: "http://localhost:10086",
      startedAt: "2026-07-11T08:00:00.000Z",
      completedAt: "2026-07-11T08:00:01.250Z",
      durationMs: 1250,
      artifactDir: "output/smoke/h5-artifacts/test",
      resultsPath: "output/smoke/h5-results.json",
      metadataLog: "output/smoke/h5-artifacts/test/h5-run-metadata.json",
      entryResponseLog: "output/smoke/h5-artifacts/test/h5-entry-response.txt",
      entryStatusCode: 200,
      entryOk: true
    },
    steps: [
      {
        flow: "登录页",
        result: "通过",
        note: "登录入口正常",
        screenshot: "output/smoke/login.png",
        log: "output/smoke/login.log"
      },
      {
        flow: "图片库页",
        result: "失败",
        note: "筛选结果数量异常"
      }
    ]
  }),
  "utf8"
);

const h5Record = runScript("scripts/create-h5-smoke-record.js", [
  "--date",
  "2026-07-11",
  "--browser",
  "Chrome desktop + mobile viewport"
]);

[
  "# H5 Smoke Record",
  "日期：2026-07-11",
  "浏览器/视口：Chrome desktop + mobile viewport",
  "构建命令：npm.cmd run build:h5",
  "| 步骤 | 页面或流程 | 类型 | 结果 | 备注 |",
  "截图或日志"
].forEach((item) => assertIncludes(h5Record, item, "H5 smoke 记录模板"));
assertRecordCoversChecklistFlows(h5Record, "h5-smoke-checklist.md", "H5 smoke 记录模板");
assertRecordCoversChecklistVisualChecks(h5Record, "h5-smoke-checklist.md", "H5 smoke 记录模板");
assertRecordCoversSmokePages(h5Record, "h5-smoke-checklist.md", "H5 smoke 记录模板");
assertRecordCoversFlowTypes(h5Record, "h5-smoke-checklist.md", "H5 smoke 记录模板");

const h5RecordWithResults = runScript("scripts/create-h5-smoke-record.js", [
  "--date",
  "2026-07-11",
  "--browser",
  "Chrome desktop + mobile viewport",
  "--results",
  resultFixturePath
]);

[
  "| 1 | 登录页 | shell | 通过 | 登录入口正常 |",
  "| 图片库页 | detail | 失败 | 筛选结果数量异常 |",
  "## Runner 元信息",
  "| Base URL | http://localhost:10086 |",
  "| 耗时 | 1250ms |",
  "| 入口探测 | 通过 |",
  "- 登录页：截图 output/smoke/login.png；日志 output/smoke/login.log"
].forEach((item) => assertIncludes(h5RecordWithResults, item, "H5 smoke 结果回填"));

const h5ResultsTemplate = runScript("scripts/create-smoke-results-template.js", ["--target", "h5"]);
assertResultsTemplateCoversChecklist(h5ResultsTemplate, "h5-smoke-checklist.md", "H5 smoke 结果模板");
runScript("scripts/create-smoke-results-template.js", ["--target", "h5", "--out", h5TemplatePath]);
assertIncludes(
  runScript("scripts/validate-smoke-results.js", ["--target", "h5", "--results", h5TemplatePath]),
  "H5 smoke 结果 JSON 校验通过。",
  "H5 smoke 结果校验"
);

const h5FinalizeResults = JSON.parse(fs.readFileSync(h5TemplatePath, "utf8"));
h5FinalizeResults.meta = {
  runner: "h5-smoke-runner",
  baseUrl: "http://localhost:10086",
  startedAt: "2026-07-11T08:00:00.000Z",
  completedAt: "2026-07-11T08:00:01.250Z",
  durationMs: 1250,
  artifactDir: "output/smoke/h5-artifacts/test",
  resultsPath: "output/smoke/h5-results.json",
  metadataLog: "output/smoke/h5-artifacts/test/h5-run-metadata.json",
  entryResponseLog: "output/smoke/h5-artifacts/test/h5-entry-response.txt",
  entryStatusCode: 200,
  entryOk: true
};
h5FinalizeResults.steps[0] = {
  ...h5FinalizeResults.steps[0],
  result: "通过",
  note: "登录入口正常",
  log: "output/smoke/h5-artifacts/test/h5-entry-response.txt"
};
fs.writeFileSync(h5FinalizeResultsPath, JSON.stringify(h5FinalizeResults, null, 2), "utf8");

runScript("scripts/finalize-smoke-record.js", [
  "--target",
  "h5",
  "--results",
  h5FinalizeResultsPath,
  "--out",
  h5FinalRecordPath,
  "--date",
  "2026-07-11",
  "--browser",
  "Chrome desktop"
]);
assert(fs.existsSync(h5FinalRecordPath), "H5 finalize 应生成记录文件");
const h5FinalRecord = fs.readFileSync(h5FinalRecordPath, "utf8");
assertIncludes(h5FinalRecord, "浏览器/视口：Chrome desktop", "H5 finalize 记录");
assertIncludes(h5FinalRecord, "## Runner 元信息", "H5 finalize 记录");
assertIncludes(h5FinalRecord, "| Runner | h5-smoke-runner |", "H5 finalize 记录");
assertIncludes(h5FinalRecord, "| Results | output/smoke/h5-results.json |", "H5 finalize 记录");
assertIncludes(h5FinalRecord, "| 入口响应 | output/smoke/h5-artifacts/test/h5-entry-response.txt |", "H5 finalize 记录");

const rnRecord = runScript("scripts/create-rn-smoke-record.js", [
  "--date",
  "2026-07-11",
  "--device",
  "Android emulator"
]);

[
  "# RN Smoke Record",
  "日期：2026-07-11",
  "设备/模拟器：Android emulator",
  "Bundle 命令：npm.cmd run build:rn",
  "| 步骤 | 页面或流程 | 类型 | 结果 | 备注 |",
  "截图或日志"
].forEach((item) => assertIncludes(rnRecord, item, "RN smoke 记录模板"));
assertRecordCoversChecklistFlows(rnRecord, "rn-smoke-checklist.md", "RN smoke 记录模板");
assertRecordCoversChecklistVisualChecks(rnRecord, "rn-smoke-checklist.md", "RN smoke 记录模板");
assertRecordCoversSmokePages(rnRecord, "rn-smoke-checklist.md", "RN smoke 记录模板");
assertRecordCoversFlowTypes(rnRecord, "rn-smoke-checklist.md", "RN smoke 记录模板");

const rnRecordWithResults = runScript("scripts/create-rn-smoke-record.js", [
  "--date",
  "2026-07-11",
  "--device",
  "Android emulator",
  "--results",
  resultFixturePath
]);

[
  "| 1 | 登录页 | shell | 通过 | 登录入口正常 |",
  "| 图片库页 | detail | 失败 | 筛选结果数量异常 |",
  "## Runner 元信息",
  "| Base URL | http://localhost:10086 |",
  "- 登录页：截图 output/smoke/login.png；日志 output/smoke/login.log"
].forEach((item) => assertIncludes(rnRecordWithResults, item, "RN smoke 结果回填"));

const rnResultsTemplate = runScript("scripts/create-smoke-results-template.js", ["--target", "rn"]);
assertResultsTemplateCoversChecklist(rnResultsTemplate, "rn-smoke-checklist.md", "RN smoke 结果模板");
runScript("scripts/create-smoke-results-template.js", ["--target", "rn", "--out", rnTemplatePath]);
assertIncludes(
  runScript("scripts/validate-smoke-results.js", ["--target", "rn", "--results", rnTemplatePath]),
  "RN smoke 结果 JSON 校验通过。",
  "RN smoke 结果校验"
);
runScript("scripts/finalize-smoke-record.js", [
  "--target",
  "rn",
  "--results",
  rnTemplatePath,
  "--out",
  rnFinalRecordPath,
  "--date",
  "2026-07-11",
  "--device",
  "Android emulator"
]);
assert(fs.existsSync(rnFinalRecordPath), "RN finalize 应生成记录文件");
assertIncludes(fs.readFileSync(rnFinalRecordPath, "utf8"), "设备/模拟器：Android emulator", "RN finalize 记录");

fs.writeFileSync(
  invalidResultPath,
  JSON.stringify({
    steps: [
      {
        flow: "不存在的流程",
        type: "detail",
        result: "未知",
        note: "",
        screenshot: "C:/temp/login.png",
        log: ""
      }
    ]
  }),
  "utf8"
);

const invalidOutput = runScriptExpectFailure("scripts/validate-smoke-results.js", [
  "--target",
  "h5",
  "--results",
  invalidResultPath
]);
assertIncludes(invalidOutput, "steps 数量应为", "错误 smoke 结果校验");
assertIncludes(invalidOutput, "result 应为", "错误 smoke 结果校验");
assertIncludes(invalidOutput, "screenshot 应使用项目内相对路径", "错误 smoke 结果校验");

console.log("Smoke 记录模板生成测试通过。");
