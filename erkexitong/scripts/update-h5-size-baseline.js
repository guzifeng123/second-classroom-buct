const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createH5BaselineEnvironment } = require("./utils/h5-size-build-env");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const taroCli = path.join(projectRoot, "node_modules", "@tarojs", "cli", "bin", "taro");
const buildEnv = createH5BaselineEnvironment();

const steps = [
  ["校验固定 Node/npm 运行时", nodeBin, ["scripts/check-runtime.js"]],
  ["生成固定配置的 H5 production 构建", nodeBin, [taroCli, "build", "--type", "h5"]],
  ["更新受控 H5 体积 baseline", nodeBin, ["scripts/analyze-h5-size.js", "--update-baseline"]]
];

for (const [label, command, args] of steps) {
  console.log(`\n[update:h5-size-baseline] ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: buildEnv,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n[update:h5-size-baseline] ${label}失败。baseline 未完成更新。`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[update:h5-size-baseline] H5 体积 baseline 已从全新 production 构建更新。");
