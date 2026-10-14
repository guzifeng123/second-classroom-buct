const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createH5BaselineEnvironment } = require("./utils/h5-size-build-env");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const taroCli = path.join(projectRoot, "node_modules", "@tarojs", "cli", "bin", "taro");
const reactNativeCli = path.join(projectRoot, "node_modules", "react-native", "cli.js");
const h5OutputRoot = path.join(projectRoot, "dist", "h5");
const h5CurrentReportPath = path.join(projectRoot, "dist", "h5-size-report.json");
const h5IndexPath = path.join(h5OutputRoot, "index.html");
const weappAppPath = path.join(projectRoot, "dist", "weapp", "app.js");
const rnBundlePath = path.join(projectRoot, "dist", "rn", "android", "index.bundle");
const temporaryPrefix = "erkexitong-h5-repro-";
const h5BaselineEnv = createH5BaselineEnvironment();

function runCheck(label, command, args, commandEnv) {
  console.log(`\n[check:builds] ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: commandEnv ?? process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n[check:builds] ${label}失败。`);
    const error = new Error(`${label}失败。`);
    error.exitCode = result.status ?? 1;
    error.alreadyReported = true;
    throw error;
  }
}

function assertExactDirectory(targetPath, expectedPath, label) {
  if (path.resolve(targetPath) !== path.resolve(expectedPath)) {
    throw new Error(`${label}路径异常：${targetPath}`);
  }
}

function cleanH5Output(label) {
  assertExactDirectory(h5OutputRoot, path.join(projectRoot, "dist", "h5"), "H5 输出目录");
  console.log(`\n[check:builds] ${label}`);
  fs.rmSync(h5OutputRoot, { recursive: true, force: true });
}

function removeTemporaryRoot(temporaryRoot) {
  if (!temporaryRoot) {
    return;
  }

  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  const relativePath = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
  const isInsideSystemTemp =
    relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);

  if (!isInsideSystemTemp || !path.basename(resolvedTemporaryRoot).startsWith(temporaryPrefix)) {
    throw new Error(`拒绝清理异常临时目录：${resolvedTemporaryRoot}`);
  }

  fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
}

function assertRequiredArtifacts() {
  const requiredArtifacts = [
    ["H5 index", h5IndexPath],
    ["微信小程序 app.js", weappAppPath],
    ["RN Android Bundle", rnBundlePath]
  ];

  for (const [label, artifactPath] of requiredArtifacts) {
    if (!fs.existsSync(artifactPath) || fs.statSync(artifactPath).size === 0) {
      throw new Error(`${label} 未生成有效输出，或被后续构建覆盖。`);
    }
  }
}

let failure = null;
let temporaryRoot = "";

try {
  runCheck("运行时版本检查", nodeBin, ["scripts/check-runtime.js"]);
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), temporaryPrefix));
  const firstReportPath = path.join(temporaryRoot, "h5-size-report-first.json");

  cleanH5Output("清理第一次 H5 构建目录");
  fs.rmSync(h5CurrentReportPath, { force: true });
  runCheck("H5 第一次构建", nodeBin, [taroCli, "build", "--type", "h5"], h5BaselineEnv);
  runCheck(
    "H5 第一次体积报告",
    nodeBin,
    ["scripts/analyze-h5-size.js", "--json", firstReportPath],
    h5BaselineEnv
  );

  cleanH5Output("清理第二次 H5 构建目录");
  runCheck("H5 第二次构建", nodeBin, [taroCli, "build", "--type", "h5"], h5BaselineEnv);
  runCheck("H5 图片预览 bundle 回归校验", nodeBin, ["scripts/validate-h5-preview-bundle.js"], h5BaselineEnv);
  runCheck(
    "H5 第二次体积报告",
    nodeBin,
    ["scripts/analyze-h5-size.js", "--json", h5CurrentReportPath],
    h5BaselineEnv
  );
  runCheck(
    "H5 连续构建复现性对比",
    nodeBin,
    ["scripts/compare-h5-reproducibility.js", firstReportPath, h5CurrentReportPath],
    h5BaselineEnv
  );
  runCheck("H5 体积基线严格对比", nodeBin, ["scripts/compare-h5-size.js", "--strict"], h5BaselineEnv);
  runCheck("微信小程序构建", nodeBin, [taroCli, "build", "--type", "weapp"]);
  runCheck("RN Android 输出目录准备", nodeBin, ["scripts/ensure-rn-output.js"]);
  runCheck("RN Android Bundle", nodeBin, [
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
  ]);
  assertRequiredArtifacts();
} catch (error) {
  failure = error;

  if (!error.alreadyReported) {
    console.error(`\n[check:builds] ${error.message}`);
  }
} finally {
  try {
    removeTemporaryRoot(temporaryRoot);
  } catch (error) {
    console.error(`\n[check:builds] 临时文件清理失败：${error.message}`);
    failure ??= error;
  }
}

if (failure) {
  process.exitCode = failure.exitCode ?? 1;
} else {
  console.log("\n[check:builds] H5 可复现构建、体积门禁、微信小程序与 RN Android 构建检查全部通过。");
}
