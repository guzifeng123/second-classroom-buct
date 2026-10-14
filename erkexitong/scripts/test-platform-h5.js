const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const h5PlatformPath = path.join(projectRoot, "src", "utils", "platform", "index.h5.ts");
const defaultPlatformPath = path.join(projectRoot, "src", "utils", "platform", "index.ts");
const appPath = path.join(projectRoot, "src", "app.tsx");
const loginPath = path.join(projectRoot, "src", "pages", "login", "index.tsx");

const h5Source = fs.readFileSync(h5PlatformPath, "utf8");
const defaultSource = fs.readFileSync(defaultPlatformPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");
const loginSource = fs.readFileSync(loginPath, "utf8");

assert.ok(h5Source.includes("getDeviceInfo"), "H5 平台实现应导出 getDeviceInfo");
assert.ok(h5Source.includes("localStorage"), "H5 平台实现应复用浏览器 Storage 保存设备 ID");
assert.ok(!h5Source.includes("@tarojs/taro"), "H5 平台实现不应导入 @tarojs/taro");
assert.ok(!h5Source.includes("getSystemInfoSync"), "H5 平台实现不应调用 getSystemInfoSync");
assert.ok(defaultSource.includes("@tarojs/taro"), "非 H5 默认实现应继续使用 Taro API");
assert.ok(defaultSource.includes("getSystemInfoSync"), "非 H5 默认实现应保留系统信息读取");
assert.ok(appSource.includes("./utils/platform/index"), "App 应改为目录式平台入口");
assert.ok(loginSource.includes("../../utils/platform/index"), "登录页应改为目录式平台入口");

console.log("H5 平台轻量实现测试通过。");
