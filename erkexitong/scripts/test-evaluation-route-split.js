const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const evaluationPagePath = path.join(projectRoot, "src", "pages", "evaluation", "index.tsx");

const source = fs.readFileSync(evaluationPagePath, "utf8");

assert.ok(
  source.includes('const EvaluationAdminDashboard = lazy(() => import("./components/EvaluationAdminDashboard"))'),
  "评定页后台面板应延后为 lazy import"
);
assert.ok(
  source.includes('const EvaluationShowcaseDashboard = lazy(() => import("./components/EvaluationShowcaseDashboard"))'),
  "评定页展示面板应延后为 lazy import"
);
assert.ok(source.includes("<Suspense fallback={null}>"), "按模式加载的评定面板应包裹 Suspense");
assert.ok(
  !source.includes('import EvaluationAdminDashboard from "./components/EvaluationAdminDashboard"'),
  "评定页不应静态导入后台面板"
);
assert.ok(
  !source.includes('import EvaluationShowcaseDashboard from "./components/EvaluationShowcaseDashboard"'),
  "评定页不应静态导入展示面板"
);

console.log("H5 评定页路由拆包测试通过。");
