# 技术栈与语言规范

本文档总结二课系统前端当前使用的技术栈、语言、构建工具和运行命令。版本信息以 `package.json` 为准。

## 核心技术栈

| 分类 | 技术 | 当前版本或说明 |
| --- | --- | --- |
| 跨端框架 | Taro | `3.6.38` |
| UI 框架 | React | `18.1.0` |
| 类型系统 | TypeScript | `^5.4.5` |
| 状态管理 | Zustand | `^5.0.14` |
| Web 渲染 | React DOM | `18.1.0` |
| 移动原生 | React Native | `0.70.15` |
| RN 运行环境 | Expo | `47.0.14` |
| RN SVG | react-native-svg | `13.7.0` |
| 样式预处理 | Sass / SCSS | `^1.77.6` |
| 构建工具 | Webpack | `5.78.0`，由 Taro webpack5 runner 驱动 |
| 编译配置 | Babel | `@babel/core`、`babel-preset-taro` |

## Taro 相关依赖

项目使用 Taro 3.6.38 系列依赖，核心包括：

- `@tarojs/cli`
- `@tarojs/components`
- `@tarojs/helper`
- `@tarojs/plugin-framework-react`
- `@tarojs/plugin-platform-h5`
- `@tarojs/plugin-platform-weapp`
- `@tarojs/react`
- `@tarojs/runtime`
- `@tarojs/runtime-rn`
- `@tarojs/taro`
- `@tarojs/taro-rn`
- `@tarojs/components-rn`
- `@tarojs/rn-runner`
- `@tarojs/rn-supporter`
- `@tarojs/taro-loader`
- `@tarojs/webpack5-runner`

新增 Taro 能力时，应优先确认是否已有同版本 Taro 官方包支持，避免引入版本跨度过大的依赖。

## 目标平台

| 平台 | 构建类型 | 说明 |
| --- | --- | --- |
| H5 | `h5` | Web 浏览器访问，开发端口默认为 `10086` |
| 微信小程序 | `weapp` | 由 Taro 编译为小程序产物 |
| Android RN | `rn` | 使用 React Native CLI 和 Taro 生成的 `metro.config.js`、`index.js` |

浏览器兼容范围由 `package.json` 中 `browserslist` 定义：最近 3 个版本、Android 5 及以上、iOS 9 及以上。

## 涉及语言和文件类型

| 类型 | 用途 | 规范 |
| --- | --- | --- |
| TypeScript (`.ts`) | 配置、服务、状态、类型和工具函数 | 开启 strict，业务类型应显式表达领域含义 |
| TSX (`.tsx`) | React 页面和组件 | 使用函数组件和 hooks，优先组合项目自定义组件 |
| SCSS (`.scss`) | 页面和组件样式 | 与页面或组件同目录放置，保持跨端样式兼容 |
| JSON (`.json`) | 包管理、项目配置、锁文件 | 不手动修改 lock 文件，依赖变更通过 `npm.cmd install` 生成 |
| Markdown (`.md`) | 项目说明、接口约定、技术规范 | 规范类文档放在 `docs` 目录 |
| SQL | 后端存储结构说明 | 当前只在 `docs/api.md` 中作为接口约定示例出现 |
| JavaScript (`.js`) | Taro、Babel、Metro、RN 入口脚本 | 只用于工具链配置和 RN 入口 |

## TypeScript 配置

`tsconfig.json` 当前关键配置：

- `target`: `ES2019`
- `module`: `ESNext`
- `moduleResolution`: `Node`
- `jsx`: `react-jsx`
- `strict`: `true`
- `noImplicitReturns`: `true`
- `noFallthroughCasesInSwitch`: `true`
- `isolatedModules`: `true`
- `skipLibCheck`: `true`

新增代码应保持 strict 兼容，不使用 `any` 绕过类型，除非是对不可控三方数据的边界封装，并且需要在封装层完成类型归一化。

## 环境变量

接口地址在 `src/services/api.ts` 中读取：

| 变量 | 用途 |
| --- | --- |
| `TARO_APP_API_BASE_URL` | REST API Base URL |
| `TARO_APP_WS_BASE_URL` | WebSocket Base URL |

业务代码不应散落读取这些变量，应通过 `API_BASE_URL`、`WS_BASE_URL` 或服务层封装使用。

## 运行命令

在 Windows PowerShell 下运行 npm 命令必须使用 `npm.cmd`。

| 场景 | 命令 |
| --- | --- |
| 安装依赖 | `npm.cmd install` |
| H5 开发 | `npm.cmd run dev:h5` |
| 微信小程序开发 | `npm.cmd run dev:weapp` |
| React Native Metro | `npm.cmd run dev:rn` |
| Taro RN 开发入口 | `npm.cmd run dev:rn:taro` |
| H5 构建 | `npm.cmd run build:h5` |
| 微信小程序构建 | `npm.cmd run build:weapp` |
| Android RN Bundle | `npm.cmd run build:rn` |
| Taro RN 构建入口 | `npm.cmd run build:rn:taro` |
| 类型检查 | `npm.cmd run typecheck` |

当前 README 记录了 Node 24 下 Taro 3.6 RN runner 直接 `spawn('npx.cmd')` 可能失败的问题。RN 相关开发应优先参考 README 中对 `dev:rn`、`build:rn`、`dev:rn:taro` 和 `build:rn:taro` 的说明。

`dev:rn` 使用 React Native CLI 启动 Metro；`build:rn` 会先运行 `scripts/ensure-rn-output.js`，再输出 Android bundle 到 `dist/rn/android`。`dev:rn:taro` 和 `build:rn:taro` 保留为 Node 18/20 环境下的原始 Taro RN 入口。

## 构建配置

主要构建配置位于 `config` 目录：

- `config/index.ts`：基础 Taro 配置，包含项目名、设计稿宽度、源码目录、输出目录、React 框架、webpack5 编译器、H5、小程序和 RN 配置。
- `config/dev.ts`：开发环境配置，H5 devServer 默认端口为 `10086`。
- `config/prod.ts`：生产环境配置，当前主要设置 H5 publicPath。

RN 相关入口：

- `index.js`：React Native 入口。
- `metro.config.js`：Metro 配置。
- `scripts/ensure-rn-output.js`：RN bundle 输出目录检查脚本。

## 服务模块

服务层当前拆分为：

| 文件 | 能力 |
| --- | --- |
| `src/services/api.ts` | REST 请求封装、API/WS 环境变量、Bearer token、错误信息归一化 |
| `src/services/authService.ts` | 登录和离线登录模式判断 |
| `src/services/evaluationService.ts` | 评定快照、远端草稿和正式提交 |
| `src/services/noteService.ts` | 图文材料列表、详情、本地索引缓存和搜索 |
| `src/services/imageLibraryService.ts` | 图片列表、本地图片缓存和远端失败兜底 |
| `src/services/submissionService.ts` | 提交摘要保存、提交历史和本地结果读取 |
| `src/services/upload.ts` | 图片选择、上传和证明图片转换 |
| `src/services/websocket.ts` | WebSocket 连接、认证、入房、心跳、重连和事件分发 |
| `src/services/transferService.ts` | 跨设备流转发送、接收应用和应用前确认 |

## 依赖维护原则

- 新增依赖前先确认是否可由 Taro、React、Zustand 或项目已有工具实现。
- Taro 相关包应保持同一主版本和补丁版本，避免跨版本混装。
- React、React DOM、React Native 版本变更会影响多端运行，必须单独验证 H5、小程序和 RN。
- `package.json` 中 `overrides` 固定了 RN 相关依赖版本，调整前必须确认 Taro RN runner 和 Metro 兼容性。
- `package-lock.json` 应由 `npm.cmd install` 生成，不手写。
