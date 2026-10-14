# 学生综合素质评定系统

Taro 3 + React + TypeScript 跨端前端，覆盖 H5、微信小程序和 Android RN 入口。

## 运行

```powershell
npm.cmd install
npm.cmd run dev:h5
npm.cmd run dev:weapp
npm.cmd run dev:rn
```

`dev:rn` / `build:rn` 使用 React Native CLI 与 Taro 生成的 `metro.config.js`、`index.js`。当前机器是 Node 24，Taro 3.6 的 RN runner 直接 `spawn('npx.cmd')` 会失败；保留了 `dev:rn:taro` 和 `build:rn:taro` 作为 Node 18/20 环境下的原始 Taro RN 入口。

## 前端验收

暂无后端时，不配置 `TARO_APP_API_BASE_URL` / `TARO_APP_WS_BASE_URL` 即进入离线演示模式：

- 可登录、填写五维材料、本地暂存、刷新恢复草稿、预览材料和清空草稿。
- 可点击流转并选择模拟设备，页面会记录最近 5 条演示流转历史。
- 不会伪造真实提交、真实图片上传或真实跨端同步成功；这些能力需要配置后端 REST API 和 WebSocket。

验收命令：

```powershell
npm.cmd run check:core
npm.cmd run check:builds
```

`check:builds` 会依次生成 H5、微信小程序和 RN Android Bundle；H5 构建同时生成 raw/gzip/Brotli 当前报告，并严格对比受版本控制的 `scripts/baselines/h5-size.json`。确认体积变化符合预期后，使用 `npm.cmd run update:h5-size-baseline` 从全新、无 API、无 sourcemap 的 production 构建显式更新基线；普通分析不会改写基线。

Taro CLI 可能提示 `C:\Users\<用户>\.taro-global-config\index.json` 不存在，这是用户级全局配置缺省提示；当前项目不依赖该文件。是否通过以命令退出码、`check:core`、`check:builds` 和相关校验脚本为准。

H5 开发验收：

```powershell
npm.cmd run dev:h5
```

启动后打开终端输出的 `http://localhost:10086/` 或局域网地址。生产构建按目标隔离到 `dist/h5/`、`dist/weapp/` 和 `dist/rn/`；微信小程序验收使用微信开发者工具打开 `dist/weapp/`。

## 当前实现

- 登录页：按 `TARO_APP_API_BASE_URL` 调用 `/login`；未配置 API 时进入明确标识的离线演示模式。
- 评定页：五维折叠面板、动态记录、文字材料、图片选择、实时计分、本地草稿和远端草稿同步。
- 图文页：标题、文字块、图片块、预览、保存、`NOTE_CONTENT` 跨端流转。
- 流转层：`Taro.connectSocket` 单例、心跳、重连、设备列表、材料流转事件。
- 图片能力：本地选择预览、上传接口封装、提交前本地证明图片上传校验、图文内容渲染组件。

## 保存与提交

- 临时保存会先写入本地草稿，再尝试 `PUT /evaluation-drafts/{userId}` 同步远端；远端失败时保留本地草稿并提示。
- 进入评定页会读取本地草稿和 `/snapshot/{userId}`，两边内容不一致时由用户选择保留本机或应用远端。
- 提交材料必须通过 `POST /evaluation-submissions` 返回成功才提示提交成功；离线模式只允许本地暂存，不会假提交。
- 提交前会校验缺少文字说明、已勾选但无材料、无效数值和未上传图片。

接口与 WebSocket 事件见 `docs/api.md`。
