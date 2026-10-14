"use strict";

const assert = require("node:assert/strict");
const {
  assertRuntimeVersions,
  parseNpmVersionFromUserAgent,
  validateLockRuntimePolicy,
  validateRuntimePolicy
} = require("./check-runtime");

function createPackageJson() {
  return {
    packageManager: "npm@11.11.0",
    engines: {
      node: "24.14.1",
      npm: "11.11.0"
    },
    devEngines: {
      runtime: {
        name: "node",
        version: "24.14.1",
        onFail: "error"
      },
      packageManager: {
        name: "npm",
        version: "11.11.0",
        onFail: "error"
      }
    }
  };
}

const policy = validateRuntimePolicy("24.14.1\n", createPackageJson());
assert.deepEqual(policy, { nodeVersion: "24.14.1", npmVersion: "11.11.0" });
validateLockRuntimePolicy(
  {
    lockfileVersion: 3,
    packages: {
      "": {
        engines: {
          node: "24.14.1",
          npm: "11.11.0"
        }
      }
    }
  },
  policy
);
assert.deepEqual(assertRuntimeVersions(policy, "v24.14.1", "11.11.0"), policy);
assert.equal(
  parseNpmVersionFromUserAgent("npm/11.11.0 node/v24.14.1 win32 x64 workspaces/false"),
  "11.11.0"
);
assert.equal(parseNpmVersionFromUserAgent("node/v24.14.1"), "");

const mismatchedEngine = createPackageJson();
mismatchedEngine.engines.node = "24.13.0";
assert.throws(
  () => validateRuntimePolicy("24.14.1", mismatchedEngine),
  /engines\.node 必须与 \.node-version 一致/
);

const warningOnlyDevEngine = createPackageJson();
warningOnlyDevEngine.devEngines.packageManager.onFail = "warn";
assert.throws(
  () => validateRuntimePolicy("24.14.1", warningOnlyDevEngine),
  /devEngines\.packageManager\.onFail 必须为 error/
);

assert.throws(
  () => assertRuntimeVersions(policy, "24.14.0", "11.11.0"),
  /Node 版本不一致/
);
assert.throws(
  () => assertRuntimeVersions(policy, "24.14.1", "11.10.0"),
  /npm 版本不一致/
);
assert.throws(
  () => validateRuntimePolicy("24", createPackageJson()),
  /必须是精确的 x\.y\.z 版本/
);
assert.throws(
  () => validateLockRuntimePolicy({ lockfileVersion: 3, packages: { "": { engines: {} } } }, policy),
  /根 engines\.node 必须与 \.node-version 一致/
);

console.log("运行时版本策略测试通过。");
