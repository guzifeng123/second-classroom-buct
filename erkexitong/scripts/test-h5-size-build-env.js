"use strict";

const assert = require("node:assert/strict");
const {
  createH5BaselineEnvironment,
  shouldRemoveInheritedKey
} = require("./utils/h5-size-build-env");

const inheritedEnvironment = {
  Path: "fixture-path",
  KEEP_ME: "fixture-value",
  node_env: "development",
  h5_analyze_sourcemap: "1",
  h5_preview_bundle_dist_root: "sentinel-preview-dist",
  h5_size_dist_root: "sentinel-dist",
  H5_SIZE_BASELINE_PATH: "sentinel-baseline",
  H5_Size_Json: "sentinel-report",
  taro_app_api_base_url: "https://sentinel-api.example",
  TARO_APP_WS_BASE_URL: "wss://sentinel-ws.example"
};
const originalEnvironment = { ...inheritedEnvironment };
const environment = createH5BaselineEnvironment(inheritedEnvironment);

assert.deepEqual(inheritedEnvironment, originalEnvironment);
assert.equal(environment.Path, "fixture-path");
assert.equal(environment.KEEP_ME, "fixture-value");
assert.equal(environment.NODE_ENV, "production");
assert.equal(environment.H5_ANALYZE_SOURCEMAP, "0");
assert.equal(environment.H5_SIZE_BUILD_MODE, "production");
assert.equal(environment.H5_SIZE_ENV_PROFILE, "default-no-api");

for (const forbiddenKey of [
  "H5_SIZE_DIST_ROOT",
  "H5_SIZE_BASELINE_PATH",
  "H5_SIZE_JSON",
  "H5_PREVIEW_BUNDLE_DIST_ROOT",
  "TARO_APP_API_BASE_URL",
  "TARO_APP_WS_BASE_URL"
]) {
  assert.equal(
    Object.keys(environment).some((key) => key.toUpperCase() === forbiddenKey),
    false,
    `${forbiddenKey} 不得从父进程继承`
  );
}

for (const canonicalKey of ["NODE_ENV", "H5_ANALYZE_SOURCEMAP", "H5_SIZE_BUILD_MODE", "H5_SIZE_ENV_PROFILE"]) {
  assert.equal(
    Object.keys(environment).filter((key) => key.toUpperCase() === canonicalKey).length,
    1,
    `${canonicalKey} 只能保留一个规范大小写键`
  );
}

assert.equal(shouldRemoveInheritedKey("h5_size_dist_root"), true);
assert.equal(shouldRemoveInheritedKey("TaRo_ApP_ApI_BaSe_Url"), true);
assert.equal(shouldRemoveInheritedKey("KEEP_ME"), false);

console.log("H5 固定构建环境清洗测试通过。");
