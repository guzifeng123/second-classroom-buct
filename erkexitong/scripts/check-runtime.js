"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const exactVersionPattern = /^\d+\.\d+\.\d+$/;

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeVersion(value, label) {
  assertCondition(typeof value === "string", `${label} 必须是字符串。`);
  const normalized = value.trim().replace(/^v/, "");
  assertCondition(exactVersionPattern.test(normalized), `${label} 必须是精确的 x.y.z 版本，当前为 ${value}。`);
  return normalized;
}

function validateDevEngine(engine, expectedName, expectedVersion, label) {
  assertCondition(engine && typeof engine === "object" && !Array.isArray(engine), `${label} 必须是对象。`);
  assertCondition(engine.name === expectedName, `${label}.name 必须为 ${expectedName}。`);
  assertCondition(engine.version === expectedVersion, `${label}.version 必须为 ${expectedVersion}。`);
  assertCondition(engine.onFail === "error", `${label}.onFail 必须为 error。`);
}

function validateRuntimePolicy(nodeVersionText, packageJson) {
  assertCondition(packageJson && typeof packageJson === "object", "package.json 必须是对象。");
  const nodeVersion = normalizeVersion(nodeVersionText, ".node-version");
  const packageManagerMatch = /^npm@(\d+\.\d+\.\d+)$/.exec(packageJson.packageManager ?? "");

  assertCondition(
    packageManagerMatch,
    "package.json.packageManager 必须使用 npm@x.y.z 固定精确 npm 版本。"
  );

  const npmVersion = normalizeVersion(packageManagerMatch[1], "package.json.packageManager");
  assertCondition(packageJson.engines && typeof packageJson.engines === "object", "package.json.engines 必须存在。");
  assertCondition(packageJson.engines.node === nodeVersion, "package.json.engines.node 必须与 .node-version 一致。");
  assertCondition(packageJson.engines.npm === npmVersion, "package.json.engines.npm 必须与 packageManager 一致。");
  assertCondition(
    packageJson.devEngines && typeof packageJson.devEngines === "object",
    "package.json.devEngines 必须存在。"
  );
  validateDevEngine(packageJson.devEngines.runtime, "node", nodeVersion, "package.json.devEngines.runtime");
  validateDevEngine(
    packageJson.devEngines.packageManager,
    "npm",
    npmVersion,
    "package.json.devEngines.packageManager"
  );

  return { nodeVersion, npmVersion };
}

function validateLockRuntimePolicy(packageLock, policy) {
  assertCondition(packageLock && typeof packageLock === "object", "package-lock.json 必须是对象。");
  assertCondition(packageLock.lockfileVersion === 3, "package-lock.json.lockfileVersion 必须为 3。");
  const rootPackage = packageLock.packages?.[""];

  assertCondition(rootPackage && typeof rootPackage === "object", "package-lock.json 缺少根 package 元数据。");
  assertCondition(
    rootPackage.engines?.node === policy.nodeVersion,
    "package-lock.json 根 engines.node 必须与 .node-version 一致。"
  );
  assertCondition(
    rootPackage.engines?.npm === policy.npmVersion,
    "package-lock.json 根 engines.npm 必须与 packageManager 一致。"
  );
}

function parseNpmVersionFromUserAgent(userAgent) {
  if (typeof userAgent !== "string") {
    return "";
  }

  return /(?:^|\s)npm\/([^\s]+)/.exec(userAgent)?.[1] ?? "";
}

function runNpmCli(npmCliPath) {
  if (!npmCliPath || !fs.existsSync(npmCliPath)) {
    return "";
  }

  const result = spawnSync(process.execPath, [npmCliPath, "--version"], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function detectNpmVersion(environment = process.env) {
  const userAgentVersion = parseNpmVersionFromUserAgent(environment.npm_config_user_agent);

  if (userAgentVersion) {
    return normalizeVersion(userAgentVersion, "当前 npm");
  }

  const npmCliCandidates = [
    environment.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  ];

  for (const npmCliPath of npmCliCandidates) {
    const detectedVersion = runNpmCli(npmCliPath);

    if (detectedVersion) {
      return normalizeVersion(detectedVersion, "当前 npm");
    }
  }

  throw new Error("无法检测当前 npm 版本；请通过 npm.cmd run check:runtime 执行校验。");
}

function assertRuntimeVersions(policy, actualNodeVersion, actualNpmVersion) {
  const nodeVersion = normalizeVersion(actualNodeVersion, "当前 Node");
  const npmVersion = normalizeVersion(actualNpmVersion, "当前 npm");

  assertCondition(
    nodeVersion === policy.nodeVersion,
    `Node 版本不一致：需要 v${policy.nodeVersion}，当前为 v${nodeVersion}。`
  );
  assertCondition(
    npmVersion === policy.npmVersion,
    `npm 版本不一致：需要 ${policy.npmVersion}，当前为 ${npmVersion}。`
  );

  return { nodeVersion, npmVersion };
}

function checkRuntime(options = {}) {
  const root = path.resolve(options.projectRoot ?? projectRoot);
  const nodeVersionText = options.nodeVersionText ?? fs.readFileSync(path.join(root, ".node-version"), "utf8");
  const packageJson = options.packageJson ?? JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const policy = validateRuntimePolicy(nodeVersionText, packageJson);
  const packageLock =
    options.packageLock ?? JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  validateLockRuntimePolicy(packageLock, policy);
  const actualNodeVersion = options.actualNodeVersion ?? process.version;
  const actualNpmVersion = options.actualNpmVersion ?? detectNpmVersion(options.environment ?? process.env);

  return assertRuntimeVersions(policy, actualNodeVersion, actualNpmVersion);
}

if (require.main === module) {
  try {
    const runtime = checkRuntime();
    console.log(`[check:runtime] 运行时版本通过：Node v${runtime.nodeVersion} / npm ${runtime.npmVersion}。`);
  } catch (error) {
    console.error(`[check:runtime] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  assertRuntimeVersions,
  checkRuntime,
  detectNpmVersion,
  normalizeVersion,
  parseNpmVersionFromUserAgent,
  validateLockRuntimePolicy,
  validateRuntimePolicy
};
