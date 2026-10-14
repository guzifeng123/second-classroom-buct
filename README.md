# 第二课堂 · 学生综合素质评定系统

面向北京化工大学第二课堂场景的学生综合素质评定系统，一套代码覆盖 **H5、微信小程序、Android（React Native）** 三端。前端基于 Taro 3 + React + TypeScript 实现，在暂无后端时可运行于离线演示模式，支持五维材料填写、实时计分、草稿暂存、图文编辑与跨端材料流转。

## 目录结构

```
.
├── erkexitong/              # 主工程：Taro 3 跨端前端
│   ├── config/              # Taro 构建配置（dev / prod）
│   ├── docs/                # 架构、接口、验收文档
│   ├── scripts/             # 构建检查、测试、冒烟验收脚本（60+）
│   │   └── baselines/       # H5 产物体积基线（受版本控制）
│   ├── src/
│   │   ├── components/      # 通用组件（评定面板、图片上传、流转按钮等）
│   │   ├── pages/           # 页面：登录 / 评定 / 图文 / 图库 / 提交结果
│   │   ├── services/        # API、WebSocket、认证、提交、监控等服务
│   │   ├── stores/          # zustand 状态管理
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── utils/           # 规范化、草稿、导出、权限等工具
│   │   ├── app.config.ts    # Taro 应用与路由配置
│   │   └── app.tsx          # 应用入口
│   ├── index.js             # RN 打包入口
│   ├── metro.config.js      # React Native Metro 配置
│   └── package.json
├── 资料/初始提示词/          # 原始需求与设计文档
│   ├── 总体架构.txt
│   ├── 存储结构设计.txt
│   ├── 文件结构.txt
│   ├── 要求1.txt
│   └── 评定细则.txt
├── 启动H5.cmd               # Windows 一键启动 H5（双击运行）
├── 启动H5.ps1               # H5 启动器 PowerShell 脚本
└── output/                  # 运行 / 验收产物（不纳入版本控制）
```

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 跨端框架 | Taro 3.6.38 |
| UI 框架 | React 18.1 |
| 语言 | TypeScript 5.4 |
| 状态管理 | zustand 5 |
| 样式 | Sass，H5 / RN 分端样式文件 |
| RN 运行时 | React Native 0.70.15 + Expo 47 |
| 构建 | Webpack 5（H5 / 小程序）、Metro（RN） |
| 验收测试 | Node 脚本 + playwright-core 冒烟测试 |
| 运行环境 | Node.js 24.14.1、npm 11.11.0 |

## 快速开始

### 方式一：一键启动（Windows）

双击根目录的 `启动H5.cmd`，脚本会自动安装依赖（首次运行）并启动 H5 开发服务器，浏览器访问 <http://localhost:10086>。

### 方式二：命令行

```powershell
cd erkexitong
npm install
npm run dev:h5        # H5 开发模式
```

### 各端命令

```powershell
npm run dev:h5        # H5 开发（http://localhost:10086）
npm run dev:weapp     # 微信小程序开发，产物在 dist/weapp/
npm run dev:rn        # React Native（Metro）
npm run build:h5      # H5 生产构建 → dist/h5/
npm run build:weapp   # 微信小程序生产构建 → dist/weapp/
npm run build:rn      # Android RN Bundle → dist/rn/android/
```

微信小程序验收：使用微信开发者工具打开 `erkexitong/dist/weapp/` 目录。

> 说明：当前机器为 Node 24，Taro 3.6 的 RN runner 直接 `spawn('npx.cmd')` 会失败，因此 `dev:rn` / `build:rn` 使用 React Native CLI 与 Taro 生成的 `metro.config.js`、`index.js`；`dev:rn:taro`、`build:rn:taro` 保留为 Node 18/20 环境下的原始 Taro RN 入口。

## 离线演示模式

不配置 `TARO_APP_API_BASE_URL` / `TARO_APP_WS_BASE_URL` 即进入离线演示模式：

- 可登录、填写五维材料、本地暂存、刷新恢复草稿、预览材料和清空草稿；
- 可点击流转并选择模拟设备，页面记录最近 5 条演示流转历史；
- **不会**伪造真实提交、真实图片上传或真实跨端同步成功——这些能力需要配置后端 REST API 与 WebSocket。

接入后端时，在 `erkexitong/` 下创建 `.env.local`（或按 Taro 方式注入环境变量）：

```
TARO_APP_API_BASE_URL=https://your-api-host
TARO_APP_WS_BASE_URL=wss://your-ws-host
```

## 功能模块

- **登录页**：按 `TARO_APP_API_BASE_URL` 调用 `/login`；未配置 API 时进入明确标识的离线演示模式。
- **评定页**：五维折叠面板、动态记录、文字材料、图片选择、实时计分、本地草稿与远端草稿同步，支持移动端导航与管理看板。
- **图文页**：标题、文字块、图片块、预览、保存，`NOTE_CONTENT` 跨端流转。
- **图库页**：图片素材库网格浏览与选择。
- **流转层**：`Taro.connectSocket` 单例、心跳、重连、设备列表、材料流转事件。
- **图片能力**：本地选择预览、上传队列、提交前本地证明图片上传校验、无障碍图片预览组件。
- **保存与提交**：本地草稿 + `PUT /evaluation-drafts/{userId}` 远端同步；提交须 `POST /evaluation-submissions` 返回成功，离线模式只暂存、不假提交；提交前校验缺失说明、无材料勾选项、无效数值与未上传图片。

## 测试与验收

```powershell
npm run check:core     # 核心逻辑检查与单元测试
npm run check:builds   # H5 / 小程序 / RN 三端构建检查
npm run typecheck      # TypeScript 类型检查
npm run check:all      # 全量检查
```

`check:builds` 会依次构建三端产物；H5 构建同时生成 raw/gzip/Brotli 体积报告，并严格对比受版本控制的 `scripts/baselines/h5-size.json`。体积变化确认符合预期后，使用 `npm run update:h5-size-baseline` 从全新、无 API、无 sourcemap 的 production 构建显式更新基线。

H5 / RN 冒烟验收清单见 `erkexitong/docs/h5-smoke-checklist.md` 与 `erkexitong/docs/rn-smoke-checklist.md`。

## 文档索引

- [erkexitong/docs/00-index.md](erkexitong/docs/00-index.md) — 文档总索引
- [erkexitong/docs/01-framework-architecture.md](erkexitong/docs/01-framework-architecture.md) — 框架架构
- [erkexitong/docs/02-tech-stack-and-languages.md](erkexitong/docs/02-tech-stack-and-languages.md) — 技术栈与语言
- [erkexitong/docs/03-development-standards.md](erkexitong/docs/03-development-standards.md) — 开发规范
- [erkexitong/docs/04-version-iteration-roadmap.md](erkexitong/docs/04-version-iteration-roadmap.md) — 版本迭代路线
- [erkexitong/docs/api.md](erkexitong/docs/api.md) — REST 接口与 WebSocket 事件
- [资料/初始提示词/](资料/初始提示词/) — 原始需求、总体架构、存储结构与评定细则
