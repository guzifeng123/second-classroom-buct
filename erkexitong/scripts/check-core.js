const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tscScript = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

const checks = [
  ["文档索引页面矩阵校验", nodeBin, ["scripts/validate-docs-index.js"]],
  ["评分配置校验", nodeBin, ["scripts/validate-evaluation-config.js"]],
  ["评分计分测试", nodeBin, ["scripts/test-evaluation-scoring.js"]],
  ["评定草稿归一化测试", nodeBin, ["scripts/test-evaluation-draft.js"]],
  ["提交前校验测试", nodeBin, ["scripts/test-evaluation-validation.js"]],
  ["H5 体积分析测试", nodeBin, ["scripts/test-h5-size-analyze.js"]],
  ["H5 体积对比测试", nodeBin, ["scripts/test-h5-size-compare.js"]],
  ["图片库归一化测试", nodeBin, ["scripts/test-image-library-normalization.js"]],
  ["图文材料归一化测试", nodeBin, ["scripts/test-note-normalization.js"]],
  ["图文快照展示测试", nodeBin, ["scripts/test-note-snapshot.js"]],
  ["图文快照服务测试", nodeBin, ["scripts/test-note-snapshot-service.js"]],
  ["提交记录接口归一化测试", nodeBin, ["scripts/test-submission-normalization.js"]],
  ["上传响应归一化测试", nodeBin, ["scripts/test-upload-normalization.js"]],
  ["页面矩阵测试", nodeBin, ["scripts/test-page-matrix.js"]],
  ["Smoke 记录模板生成测试", nodeBin, ["scripts/test-smoke-record-generators.js"]],
  ["H5 smoke runner 测试", nodeBin, ["scripts/test-h5-smoke-runner.js"]],
  ["H5 smoke 清单校验", nodeBin, ["scripts/validate-h5-smoke-checklist.js"]],
  ["RN smoke 清单校验", nodeBin, ["scripts/validate-rn-smoke-checklist.js"]],
  ["图文快照路由校验", nodeBin, ["scripts/validate-note-snapshot-routes.js"]],
  ["TypeScript 类型检查", nodeBin, [tscScript, "--noEmit"]]
];

for (const [label, command, args] of checks) {
  console.log(`\n[check:core] ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n[check:core] ${label}失败。`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[check:core] 核心检查全部通过。");
