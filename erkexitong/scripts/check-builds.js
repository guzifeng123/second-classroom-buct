const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const taroCli = path.join(projectRoot, "node_modules", "@tarojs", "cli", "bin", "taro");
const reactNativeCli = path.join(projectRoot, "node_modules", "react-native", "cli.js");
const rnBundlePath = path.join(projectRoot, "dist", "rn", "android", "index.bundle");

const checks = [
  ["H5 构建", nodeBin, [taroCli, "build", "--type", "h5"]],
  ["H5 体积分析", nodeBin, ["scripts/analyze-h5-size.js"]],
  ["微信小程序构建", nodeBin, [taroCli, "build", "--type", "weapp"]],
  ["RN Android 输出目录准备", nodeBin, ["scripts/ensure-rn-output.js"]],
  [
    "RN Android Bundle",
    nodeBin,
    [
      reactNativeCli,
      "bundle",
      "--platform",
      "android",
      "--dev",
      "false",
      "--entry-file",
      "index.js",
      "--bundle-output",
      "dist/rn/android/index.bundle",
      "--assets-dest",
      "dist/rn/android/assets"
    ]
  ]
];

for (const [label, command, args] of checks) {
  console.log(`\n[check:builds] ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n[check:builds] ${label}失败。`);
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(rnBundlePath) || fs.statSync(rnBundlePath).size === 0) {
  console.error("\n[check:builds] RN Android Bundle 未生成有效输出。");
  process.exit(1);
}

console.log("\n[check:builds] H5、微信小程序与 RN Android 构建检查全部通过。");
