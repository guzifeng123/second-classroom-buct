const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;

const checks = [
  ["核心测试与类型检查", ["scripts/check-core.js"]],
  ["H5、微信小程序与 RN 构建检查", ["scripts/check-builds.js"]]
];

for (const [label, args] of checks) {
  console.log(`\n[check:all] ${label}`);
  const result = spawnSync(nodeBin, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n[check:all] ${label}失败。`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[check:all] 合并前检查全部通过。");
