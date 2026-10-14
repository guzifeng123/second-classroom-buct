"use strict";

const blockedExactKeys = new Set([
  "NODE_ENV",
  "H5_ANALYZE_SOURCEMAP",
  "H5_PREVIEW_BUNDLE_DIST_ROOT",
  "TARO_APP_API_BASE_URL",
  "TARO_APP_WS_BASE_URL"
]);

function shouldRemoveInheritedKey(key) {
  const normalizedKey = key.toUpperCase();
  return normalizedKey.startsWith("H5_SIZE_") || blockedExactKeys.has(normalizedKey);
}

function createH5BaselineEnvironment(sourceEnvironment = process.env) {
  const environment = {};

  Object.entries(sourceEnvironment).forEach(([key, value]) => {
    if (!shouldRemoveInheritedKey(key)) {
      environment[key] = value;
    }
  });

  return {
    ...environment,
    NODE_ENV: "production",
    H5_ANALYZE_SOURCEMAP: "0",
    H5_SIZE_BUILD_MODE: "production",
    H5_SIZE_ENV_PROFILE: "default-no-api"
  };
}

module.exports = {
  createH5BaselineEnvironment,
  shouldRemoveInheritedKey
};
