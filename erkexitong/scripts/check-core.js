const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tscScript = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

const checks = [
  ["运行时版本检查", nodeBin, ["scripts/check-runtime.js"]],
  ["运行时版本策略测试", nodeBin, ["scripts/test-runtime-check.js"]],
  ["文档索引页面矩阵校验", nodeBin, ["scripts/validate-docs-index.js"]],
  ["评分配置校验", nodeBin, ["scripts/validate-evaluation-config.js"]],
  ["评分计分测试", nodeBin, ["scripts/test-evaluation-scoring.js"]],
  ["评定草稿归一化测试", nodeBin, ["scripts/test-evaluation-draft.js"]],
  ["提交前校验测试", nodeBin, ["scripts/test-evaluation-validation.js"]],
  ["评定草稿同步状态测试", nodeBin, ["scripts/test-evaluation-sync-status.js"]],
  ["评定状态栏展示测试", nodeBin, ["scripts/test-evaluation-status-display.js"]],
  ["H5 评定页路由拆包测试", nodeBin, ["scripts/test-evaluation-route-split.js"]],
  ["审核统计口径测试", nodeBin, ["scripts/test-review-stats.js"]],
  ["监控埋点工具测试", nodeBin, ["scripts/test-monitoring.js"]],
  ["监控上报服务测试", nodeBin, ["scripts/test-monitoring-service.js"]],
  ["登录角色权限测试", nodeBin, ["scripts/test-auth-permissions.js"]],
  ["图片预览可访问性与受限预加载测试", nodeBin, ["scripts/test-image-preview-accessibility.js"]],
  ["H5 图片预览 bundle 校验测试", nodeBin, ["scripts/test-h5-preview-bundle.js"]],
  ["H5 固定构建环境清洗测试", nodeBin, ["scripts/test-h5-size-build-env.js"]],
  ["H5 体积分析测试", nodeBin, ["scripts/test-h5-size-analyze.js"]],
  ["H5 体积对比测试", nodeBin, ["scripts/test-h5-size-compare.js"]],
  ["H5 构建复现报告比较测试", nodeBin, ["scripts/test-h5-reproducibility.js"]],
  ["H5 平台轻量实现测试", nodeBin, ["scripts/test-platform-h5.js"]],
  ["H5 双栏响应式按需加载测试", nodeBin, ["scripts/test-web-split-layout-responsive.js"]],
  ["图片库归一化测试", nodeBin, ["scripts/test-image-library-normalization.js"]],
  ["图文材料归一化测试", nodeBin, ["scripts/test-note-normalization.js"]],
  ["图文材料资产元数据测试", nodeBin, ["scripts/test-note-asset-metadata.js"]],
  ["图文材料离线保存测试", nodeBin, ["scripts/test-note-store.js"]],
  ["图文快照展示测试", nodeBin, ["scripts/test-note-snapshot.js"]],
  ["图文快照服务测试", nodeBin, ["scripts/test-note-snapshot-service.js"]],
  ["提交记录 CSV 导出测试", nodeBin, ["scripts/test-submission-export.js"]],
  ["提交详情服务测试", nodeBin, ["scripts/test-submission-service.js"]],
  ["提交记录接口归一化测试", nodeBin, ["scripts/test-submission-normalization.js"]],
  ["WebSocket 流转 ACK 测试", nodeBin, ["scripts/test-transfer-delivery.js"]],
  ["图片上传逐张队列测试", nodeBin, ["scripts/test-upload-queue.js"]],
  ["上传响应归一化测试", nodeBin, ["scripts/test-upload-normalization.js"]],
  ["页面矩阵测试", nodeBin, ["scripts/test-page-matrix.js"]],
  ["RN 样式静态校验规则测试", nodeBin, ["scripts/test-rn-style-validation.js"]],
  ["RN 样式静态校验", nodeBin, ["scripts/validate-rn-styles.js"]],
  ["RN 公共源码语法校验", nodeBin, ["scripts/validate-rn-source-syntax.js"]],
  ["Smoke 记录模板生成测试", nodeBin, ["scripts/test-smoke-record-generators.js"]],
  ["H5 smoke runner 测试", nodeBin, ["scripts/test-h5-smoke-runner.js"]],
  ["H5 smoke 矩阵 runner 测试", nodeBin, ["scripts/test-h5-smoke-matrix.js"]],
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
