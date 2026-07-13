const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const checklistPath = path.join(projectRoot, "docs", "h5-smoke-checklist.md");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(fs.existsSync(checklistPath), "缺少 docs/h5-smoke-checklist.md");

const content = fs.readFileSync(checklistPath, "utf8");
const requiredSections = ["## 目标", "## 前置条件", "## 验收流程", "## 视觉检查", "## 记录格式"];
const requiredFlows = [
  "登录页",
  "评定页首页",
  "评定页填报",
  "保存草稿",
  "图片上传区域",
  "图片库页",
  "图文材料列表页",
  "图文编辑页",
  "图文快照页",
  "图文材料引用",
  "提交前预览页",
  "定位校验问题",
  "提交失败提示",
  "提交结果页",
  "提交历史页",
  "状态说明页"
];
const requiredChecks = [
  "npm.cmd run build:h5",
  "npm.cmd run smoke:h5:record",
  "API",
  "WebSocket",
  "离线",
  "本地图片失败",
  "失败图片定位",
  "快照页",
  "图片预览",
  "固定占位",
  "已知 H5 体积告警",
  "截图或日志"
];

requiredSections.forEach((section) => {
  assert(content.includes(section), `H5 smoke 清单缺少章节：${section}`);
});

requiredFlows.forEach((flow) => {
  assert(content.includes(flow), `H5 smoke 清单缺少流程：${flow}`);
});

requiredChecks.forEach((check) => {
  assert(content.includes(check), `H5 smoke 清单缺少检查项：${check}`);
});

console.log("H5 smoke 清单校验通过。");
