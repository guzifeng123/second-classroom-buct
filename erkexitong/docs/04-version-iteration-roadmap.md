# 版本迭代优化方向

本文档用于记录二课系统前端当前完成状态、后续版本方向和仍需后端/API 配合的事项。历史逐日处理记录已合并为按能力分类的完成情况，避免路线图变成流水账。

## 当前完成状态

截至 2026-07-17，前端已从可演示版本推进到具备稳定填报闭环、材料复用、提交快照、基础审核视图、多端构建检查和可重复真实浏览器 smoke 的阶段。

| 能力域 | 已完成内容 | 主要入口或脚本 |
| --- | --- | --- |
| 填报闭环 | 登录、评定填报、本地草稿、远端草稿同步、提交前预览、正式提交、提交结果和提交历史已形成闭环；离线模式不会伪造正式提交。 | `pages/evaluation/index`、`pages/evaluation/preview/index`、`pages/submission/result/index`、`pages/submission/history/index` |
| 问题定位 | 提交前校验问题可从预览页返回评定页，自动切换填报模式、展开维度、滚动到条目并聚焦字段；本地图片问题会高亮上传区域并标记图片序号。 | `src/utils/evaluationValidation.ts`、`src/utils/evaluationIssueFocus.ts` |
| 提交快照 | 提交摘要保存五维得分、材料数量、提交时间、规则版本、校验问题快照和提交时材料快照；提交结果页优先读取服务端提交详情，失败或离线时回退本地快照；提交后回看不依赖当前草稿。 | `src/services/submissionService.ts`、`src/utils/submissionNormalization.ts` |
| 图文快照 | 图文引用会写入独立快照 key，快照页优先按 `snapshotKey` 读取，并保留旧最近快照 key 兼容兜底；图片预览和失败占位已接入。 | `pages/note/snapshot/index`、`src/services/noteSnapshotService.ts` |
| 材料复用 | 评定条目可复用图片库图片和图文材料；图片与图文都记录引用次数、最近使用时间和关联维度/分区/条目。图文支持标签、来源、关联维度编辑与搜索，元数据会进入本地草稿、远端保存请求、跨设备流转和引用快照，旧缓存自动补齐。 | `pages/image/library/index`、`pages/note/edit/index`、`src/services/noteService.ts`、`src/utils/imageLibraryNormalization.ts`、`src/utils/noteNormalization.ts` |
| 图片上传 | 图片选择支持格式/大小预检；多图上传按单张成功结果落库；逐张队列展示短文件名、缩略图、等待/上传中/成功/失败/取消/待重试状态和独立失败原因；失败或取消后保留成功项，并支持单张重传或移除；提交前本地证明图片批量上传显示进度。 | `src/components/UploadImageButton`、`src/services/upload.ts`、`src/utils/uploadNormalization.ts`、`src/utils/uploadQueue.ts` |
| 反馈文案 | 本地暂存、远端未同步、离线不可正式提交、正式提交失败、图片选择/上传失败和补传后立即提交提示已统一到可复用文案工具；图文材料离线保存不会请求 `/notes`，并明确显示“本地已保存”。 | `src/utils/feedbackMessages.ts`、`src/utils/noteSaveStatus.ts` |
| 同步状态 | 草稿同步状态已细化为本地未保存、本地已保存、远端同步中、远端已同步和同步失败；状态栏会展示保存位置、最近保存时间，把失败分为网络、权限、数据校验和未知异常，并提供一键重试；同步失败分类已优先支持稳定错误码和 HTTP 状态码，仍保留错误文案兜底；权限类失败会直接提供重新登录入口；离线演示保存保持“本地已保存”，不会伪装成远端同步失败。 | `src/stores/useEvaluationStore.ts`、`src/pages/evaluation/components/EvaluationStatusBar.tsx`、`src/utils/evaluationSyncStatus.ts`、`npm.cmd run test:evaluation-status-display`、`npm.cmd run test:evaluation-sync-status` |
| 草稿冲突 | 本机与远端草稿不同时，选择弹窗会展示双方保存时间、来源位置、可选草稿版本、已选条目数、材料数、图片数、总差异条目数、按维度差异摘要、逐条差异预览、版本新旧和覆盖后果；远端响应提供 `deviceName` 时会显示具体设备。 | `src/utils/evaluationDraft.ts`、`src/stores/useEvaluationStore.ts`、`npm.cmd run test:evaluation-draft` |
| 流转可靠性 | 客户端流转已增加稳定消息 ID、发送时间、等待确认/已送达/失败状态、10 秒 ACK 超时、断线失败、接收端回执、服务端时间展示和复用原消息 ID 的手动重试；离线演示记录不会伪装成真实送达。H5 渲染检查还发现并修复了广播占位设备重复出现在目标列表的问题。 | `src/services/websocket.ts`、`src/services/transferService.ts`、`src/stores/useTransferStore.ts`、`npm.cmd run test:transfer-delivery` |
| 审核视图 | 评定页后台模式已展示审核记录、问题队列、五维分布、提交历史入口和基础排序；后台入口已接入登录角色权限，学生只显示填报和展示入口；学生提交历史展示审核状态、审核意见、退回原因和补充入口；提交记录 CSV 字段口径已集中到工具层，后台列表可导出当前筛选结果；审核统计口径已集中到工具层，页面展示班级提交率、待处理、退回、平均分、材料完成度和风险维度。 | `src/pages/evaluation/components/EvaluationAdminDashboard.tsx`、`src/utils/reviewStatus.ts`、`src/utils/reviewStats.ts`、`src/utils/authPermissions.ts`、`src/utils/submissionExport.ts` |
| 监控埋点 | 前端已提供轻量监控工具，按统一事件格式记录错误日志、接口失败统计和关键操作状态；`request` 会记录网络/HTTP 失败，远端草稿保存和正式提交会记录 attempt/success/failed/blocked，草稿本地/远端保存也会记录结果。工具层会默认脱敏用户标识、正文、图片 URL、长字符串和常见密钥字段，并已提供批量上报 payload、上报服务和按事件 ID 清理已上传事件的接口；未配置 API 或上报失败时不会丢弃本地事件。 | `src/utils/monitoring.ts`、`src/services/monitoringService.ts`、`src/services/api.ts`、`src/services/evaluationService.ts`、`src/stores/useEvaluationStore.ts`、`npm.cmd run test:monitoring`、`npm.cmd run test:monitoring-service` |
| 评分规则 | 评分规则集中配置，带版本号 `2026.07.v1`；已覆盖配置结构校验、计分测试、草稿归一化和提交前校验测试。 | `src/data/evaluationConfig.ts`、`npm.cmd run validate:evaluation`、`npm.cmd run test:evaluation` |
| 页面矩阵 | 注册页面、页面类型、H5 详情白名单、文档入口和 smoke 覆盖统一校验；新增页面需要同时补齐 TSX、H5 SCSS、RN SCSS 和文档入口。 | `scripts/utils/page-matrix.js`、`npm.cmd run test:page-matrix`、`npm.cmd run validate:docs-index` |
| H5 smoke | checklist、结果 JSON、严格证据校验、finalize、项目内真实浏览器 runner 和多浏览器矩阵 wrapper 已完成。2026-07-17 使用 `playwright-core` + 系统 Edge 通过 `dist/h5` 产物完成 16 步：15 通过、0 失败、1 跳过；唯一跳过是未配置真实后端时的正式提交，fixture 结果页已验证。逐步截图、trace、diagnostics、控制台异常归因和移动/桌面/断点响应式检查已归档。 | `docs/h5-smoke-checklist.md`、`npm.cmd run smoke:h5:matrix`、`output/smoke/h5-matrix/2026-07-17T03-25-10-699Z/msedge-results.json`、`output/playwright/h5-smoke-matrix/2026-07-17T03-25-10-699Z/msedge/h5-browser-diagnostics.json` |
| 跨端输入稳定性 | Taro 3.6.38 H5 `Textarea.watchValue` 在内部 ref 尚未建立时会抛出运行时异常；现已通过项目自定义 `StableTextarea` 统一 props，H5 使用原生受控 `textarea`，小程序和 RN 保持 Taro `Textarea`。图文编辑、刷新恢复、材料引用和控制台回归均通过。 | `src/components/StableTextarea`、`src/components/ProofItem/index.tsx`、`src/pages/note/edit/index.tsx` |
| 跨端图片预览 | 图片库页和 `NoteContentRenderer` 已统一复用 `ImagePreview`；H5 使用 React Portal 与原生 DOM 灯箱，支持前后切换、键盘关闭、焦点循环与恢复、滚动锁、触摸滑动、加载失败重试和相邻图片受限预加载，不再引入 Taro H5 `previewImage` / Swiper；微信小程序和 RN 继续调用 `Taro.previewImage`。2026-07-17 真实 H5 smoke 已验证图片库预览在 390×844 下无横向溢出，Escape 关闭后焦点恢复。 | `src/components/ImagePreview`、`src/pages/image/library/index.tsx`、`src/components/NoteContentRenderer/index.tsx`、`npm.cmd run test:image-preview-accessibility`、`output/playwright/h5-smoke-matrix/2026-07-17T03-25-10-699Z/msedge/h5-browser-diagnostics.json` |
| RN smoke | RN checklist、结果 JSON 模板、记录生成、结果校验和 finalize 归档已完成；2026-07-13 已成功生成 Android Bundle，并消除 7 条无效全局选择器和 3 条非法字重样式警告；新增静态校验阻止这两类警告回归。后续构建又发现 Metro 0.72 压缩器不兼容数字分隔符，已清理公共源码并写入开发规范。预检记录位于 `output/smoke/rn-smoke-2026-07-13.md`，因当前机器无 Android SDK、adb、模拟器、Java 或真机，12 项真实交互如实保留为“未执行”。 | `docs/rn-smoke-checklist.md`、`npm.cmd run build:rn`、`npm.cmd run validate:rn-styles`、`npm.cmd run smoke:rn:finalize` |
| 工程检查 | `check:core` 已聚合精确 Node/npm 校验、运行时与 H5 复现 comparator fixture、文档矩阵、评分配置、监控埋点口径和上报服务、H5 图片预览可访问性/受限预加载与 bundle 规则测试、核心工具测试、页面矩阵、RN 样式静态校验、smoke 记录、H5 runner 与矩阵 runner、图文快照路由和 TypeScript 检查；`check:builds` 已编排两次干净 H5 构建后再执行复现、图片预览和体积门禁，并继续构建微信小程序与 RN Android Bundle。2026-07-16 已更新 H5 体积 baseline，`check:core` 与 `check:builds` 均通过。 | `npm.cmd run check:runtime`、`npm.cmd run test:monitoring`、`npm.cmd run test:monitoring-service`、`npm.cmd run test:h5-reproducibility`、`npm.cmd run test:image-preview-accessibility`、`npm.cmd run test:h5-smoke-matrix`、`npm.cmd run check:core`、`npm.cmd run check:builds` |
| 构建产物隔离 | H5 渲染检查发现原先 H5、微信小程序与 RN 共用 `dist` 会相互清空产物；现已隔离到 `dist/h5`、`dist/weapp`、`dist/rn`，`check:builds` 会在固定 H5 profile 下执行三尺寸基线门禁，并在全部构建结束后确认三端产物仍同时存在。统一图文页面组件导入顺序后，微信小程序 CSS 冲突顺序警告也已消除。 | `config/index.ts`、`scripts/check-builds.js`、`npm.cmd run check:builds` |
| H5 体积 | schema v1 报告、raw/gzip/Brotli 逐资源计量、构建与压缩元数据、路由语义 `logicalKey`、严格 schema 校验、显式 baseline 更新和真实构建门禁已完成。以图片预览拆包前报告为参照，全部 JS 从 1513552 / 436928 / 368848 B 降至 1387509 / 412938 / 350219 B，仍减少 126043 / 23990 / 18629 B。2026-07-17 已按固定 production profile 更新 baseline，把图片预览可访问性、H5 响应式按需加载和评定页后台/展示拆包后的稳定产物纳入门禁。 | `npm.cmd run analyze:h5-size:json`、`npm.cmd run compare:h5-size -- --strict`、`npm.cmd run update:h5-size-baseline` |
| H5 启动依赖 | 平台识别已拆为目录式跨端入口，H5 使用 `src/utils/platform/index.h5.ts` 的浏览器轻量实现保存设备 ID 和生成设备名，小程序/RN 保留 Taro `getSystemInfoSync`；H5 产物已确认不再包含 `getSystemInfoSync`。 | `src/utils/platform/index.h5.ts`、`src/utils/platform/index.ts`、`npm.cmd run test:platform-h5` |
| H5 响应式加载 | H5 详情页双栏布局基于 `matchMedia("(min-width: 1180px)")` 按需挂载评定 master：390×844 移动详情页不创建 `.web-split-layout` / `.web-split-layout__master`；1280px 桌面详情页继续加载评定 master 并保持双栏。2026-07-17 已把窄屏详情页改为稳定 inline detail 容器，断点切换时不再重挂载图片库页，避免图片预览 state 丢失后触发 Taro 页面 transform 横向溢出；runner diagnostics 会记录 `.web-split-layout`、`.web-split-layout__master`、`.web-split-layout__detail` 和 inline detail 实际数量，当前移动四个响应式 flow 均为 0，图片库页、图文编辑页和提交前预览页在 1280px 桌面均为双栏 1/1/1，在 1179px 均为 inline、1180px 均为双栏。 | `src/components/WebSplitLayout/index.tsx`、`npm.cmd run test:web-split-layout-responsive`、`npm.cmd run check:core`、`output/smoke/h5-matrix/2026-07-17T03-25-10-699Z/msedge-results.json` |
| H5 评定页路由拆包 | 评定页已把后台面板和展示面板改为 `lazy import`，`route/pages/evaluation/index.js` 从 246.2 KiB raw / 67.6 KiB gzip / 55.6 KiB Brotli 降到 229.0 KiB raw / 64.2 KiB gzip / 53.0 KiB Brotli，压到 244 KiB 单资源建议阈值以下，且不影响填报默认路径。 | `src/pages/evaluation/index.tsx`、`scripts/test-evaluation-route-split.js`、`npm.cmd run build:h5`、`npm.cmd run analyze:h5-size:json` |

## 文档保留说明

当前 `docs/` 下文档都仍有维护价值：

| 文档 | 保留原因 |
| --- | --- |
| `00-index.md` | 文档入口和页面入口矩阵，`validate:docs-index` 会校验。 |
| `01-framework-architecture.md` | 当前页面、状态、服务和数据流说明。 |
| `02-tech-stack-and-languages.md` | 技术栈、命令和脚本清单。 |
| `03-development-standards.md` | 新增页面、组件、接口和跨端样式规范。 |
| `04-version-iteration-roadmap.md` | 完成情况、后续版本和 API 配合点的合并视图。 |
| `api.md` | REST、Storage 和 WebSocket 契约。 |
| `h5-smoke-checklist.md` | H5 smoke 生成器、校验脚本和 runner 的数据来源。 |
| `rn-smoke-checklist.md` | RN smoke 生成器和校验脚本的数据来源。 |

因此本轮不删除这些文档；“没用的文档”已通过合并历史记录的方式清理为单一路线图。

## 版本节奏

| 阶段 | 定位 | 当前判断 | 交付重点 |
| --- | --- | --- | --- |
| V0.2 | 稳定填报闭环 | 核心能力已基本完成 | 保持回归稳定，补齐人工验收记录 |
| V0.3 | 提升填报效率 | 部分完成 | 材料复用深化、同步状态细化、真实 H5 浏览器 smoke |
| V0.5 | 形成审核协作 | 具备前端雏形 | 审核状态流转、批量筛选、统计视图、导出能力 |
| V1.0 | 支撑真实上线 | 依赖后端和运维 | 权限、接口契约、构建矩阵、错误监控和关键操作埋点 |

优先级说明：

- P0：影响真实填报、提交和上线验收，优先进入近期迭代。
- P1：显著提升使用效率、审核效率或跨端稳定性，进入中期迭代。
- P2：增强型能力，适合在主流程稳定后逐步补齐。

## 后续优化池

| 优先级 | 能力 | 待处理事项 | 验收标准 |
| --- | --- | --- | --- |
| P0 | smoke 验收 | H5 已在 2026-07-14 通过项目 runner + Edge 完成 15 项真实交互和 1 项诚实跳过；严格门禁要求通过/失败具备备注与截图或日志、跳过说明原因、证据路径真实存在。后续继续补齐 RN 真机/模拟器验收和 H5 服务端正式提交。 | `validate:smoke-results` 与 `smoke:*:finalize` 均通过；失败项归因到实际 flow，不能被后续跳过覆盖。 |
| P0 | H5 自动化 | 项目 runner 已覆盖入口/静态预检、登录、填报、离线草稿恢复、图片选择与预览、图片库筛选、图文编辑/引用/快照、预览定位、Taro ActionSheet/Modal、离线提交拦截、fixture 结果/历史、状态说明页、控制台异常归因、trace 和 390×844 溢出检查；图片库步骤已新增首次直达 JS 无 Swiper、原生按钮与可访问名称、Enter/Space 打开、切换、计数、移动预览无溢出、Escape 关闭和焦点恢复断言。2026-07-17 真实 Edge 矩阵归档已通过：`unexpectedConsoleEntries`、`pageErrors` 均为空，移动响应式 diagnostics 明确记录 `layoutShellCount=0`、`layoutMasterCount=0`，桌面响应式 diagnostics 记录图片库详情页 `layoutShellCount=1`、`layoutMasterCount=1`、`layoutDetailCount=1`，断点 diagnostics 记录图片库页、图文编辑页和提交前预览页 1179px 不挂 master、1180px 挂 master，`mobilePreviewNoOverflow`、`escapeClosed`、`focusRestored` 均为 true。注意静态服务必须指向当前生产产物 `dist/h5`，不要误用历史遗留的 `dist/` 根目录。 | 既有归档保持 15 通过、0 失败、1 个有明确原因的正式提交跳过；图片预览与响应式计数断言已有截图和 diagnostics 证据，接入后端后再升级为 16 通过。 |
| P0 | 后端提交详情 | 前端已接入 `GET /evaluation-submissions/{submissionId}` 远端详情读取、详情缓存和本地兜底；后续需后端真实返回完整 `records`、`selectedItemIds`、维度汇总、校验问题、审核状态和规则版本。 | 提交结果页可从服务端恢复不可变快照，接口失败时明确展示本地兜底来源；后端接入后历史详情也应支持从服务端打开完整快照。 |
| P0 | 权限入口 | 已接入前端登录角色、离线演示角色推断和评定页后台入口控制；后续需与后端统一角色字段、服务端鉴权和审核接口权限。 | 学生角色无法进入后台模式；班委、辅导员和管理员可见后台入口；后端接入后服务端必须拒绝越权审核操作。 |
| P1 | 同步状态体验 | 前端状态模型、最近保存时间、手动重试入口和网络/权限/数据校验/未知异常分级说明已完成；`ApiError` 已支持从响应体 `code`、`errorCode`、`error_code` 提取稳定错误码，评定草稿 store 会保留远端失败的错误码和 HTTP 状态码，状态栏和重试提示优先按稳定错误码/状态码分类，旧错误文案继续作为兜底；权限类同步失败会在状态栏提供重新登录入口。后续需与后端统一错误码枚举，按错误类型增加退避重试和更细的失败埋点。 | 用户能一键重试远端同步，并区分网络失败、权限失败和接口校验失败；权限失效时能直接回到登录页；`npm.cmd run test:evaluation-status-display` 与 `npm.cmd run test:evaluation-sync-status` 覆盖错误码、状态码和文案兜底；后端接入后分类由稳定错误码驱动。 |
| P1 | 浏览器回归稳定性 | 离线保存、刷新恢复、预览跳转、问题定位、Taro 弹窗和提交拦截已固化为 runner 断言；console/page error 会归因到产生时的实际 flow。2026-07-16 新增 `smoke:h5:matrix`，会按浏览器通道复用同一 H5 checklist，逐通道产出 results/artifacts 并立即执行严格证据校验；`test:h5-smoke-matrix` 覆盖多通道 static-only 编排、schema 校验和入口失败聚合。后续补真实 Chromium/移动 Safari 兼容证据。 | Edge 基线持续为 0 unexpected console、0 page error、0 fatal；新增浏览器通道不得绕过 checklist、`validate:smoke-results` 或项目内证据路径；真实矩阵归档需保留每个通道的 results、trace、diagnostics 和失败归因。 |
| P1 | 图文离线语义 | 离线图文保存不请求 `/notes`、显示“本地已保存”、刷新恢复正文和材料引用已固化进 runner；`StableTextarea` 消除了 Taro H5 watcher 异常。后续只需在配置真实 API 后补在线保存与冲突场景。 | 未配置 API 时无 `/notes` 请求且控制台无异常；配置 API 后保存结果、失败状态和本地兜底均可重复验证。 |
| P1 | H5 体积基线治理 | 已完成：schema v1 覆盖 totals、entrypoint 和 asset 的 raw/gzip/Brotli，记录固定构建 profile、压缩参数和运行时；content hash 被归一化，路由 chunk 使用页面语义 `logicalKey`；普通分析禁止覆盖 `scripts/baselines/h5-size.json`，更新命令会先做全新 production 构建。2026-07-17 因前序已验证的图片预览可访问性、H5 响应式按需加载和评定页路由拆包已进入稳定产物，重新生成 baseline：入口 358.4 KiB raw / 112.2 KiB gzip / 96.8 KiB Brotli，JS 总量 1355.0 KiB raw / 403.3 KiB gzip / 342.0 KiB Brotli，CSS 总量 255.8 KiB raw / 43.9 KiB gzip / 38.2 KiB Brotli；随后严格对比 0 变化通过。 | `test:h5-size-analyze`、`test:h5-size-compare`、默认严格比较和 `check:builds` 均通过；hash 改名同尺寸不误报，三种尺寸及汇总任一越线均返回非零。 |
| P1 | H5 构建可复现性 | 已完成：`.node-version`、`engines`、`packageManager`、npm 11 `devEngines` 和无依赖校验脚本共同固定 Node `24.14.1` / npm `11.11.0`；`ImageLibraryGrid`、`UploadImageButton` 已使用稳定 `webpackChunkName`，`WebSplitLayout` 的评定页 chunk 继续由 Taro 路由映射保持 `route/pages/evaluation/index` 语义；comparator 只忽略 `generatedAt`，其余完整报告和三个 lazy logicalKey 均 fail closed。2026-07-16 已通过真实 `check:builds`：两次 H5 报告除 `generatedAt` 外完全一致，稳定懒加载 logicalKey 为 `js/lazy-image-library-grid.js`、`js/lazy-upload-image-button.js`、`css/lazy-upload-image-button.css`，随后微信小程序构建和 RN Android Bundle 也通过。仓库当前没有 CI workflow，后续接入时必须读取 `.node-version`、使用 `npm ci` 并运行同一门禁。 | `npm.cmd run check:builds` 通过；后续 Node/npm 安全升级必须原子更新全部版本入口并复验三端与三尺寸。 |
| P1 | H5 跨目录复现 | 当前门禁验证同一工作区连续两次构建；Taro Babel preset 默认使用绝对 `@babel/runtime` 路径，并明确提示项目移动时可能造成 hash 不一致。后续在两个不同 checkout 根目录构建同一提交，评估在确认 runtime 版本受 lock 约束后设置 `absoluteRuntime: false`，避免机器路径进入构建身份。 | 两个不同绝对路径 checkout 的 H5 path、logicalKey 与三尺寸一致；若关闭 `absoluteRuntime`，H5、小程序和 RN 构建及运行时 helper 解析全部通过。 |
| P1 | H5 图片预览拆包 | 已完成：自定义 `ImagePreview` 在 H5 使用 React Portal / 原生 DOM，图片库和 `NoteContentRenderer` 统一复用；小程序和 RN 保留 `Taro.previewImage`。产物门禁会扫描全部 H5 JS，禁止四个 Swiper 标记，要求存在轻量预览标记，并要求图片库路由 JS raw 严格小于 `249856` B。 | 图片库路由 JS 从 253614 / 66517 / 55742 B 降至 61582 / 18703 / 15868 B，分别减少 192032 / 47814 / 39874 B；全量 JS 同步减少 183423 / 45387 / 37929 B。`test:h5-preview-bundle` 覆盖 fail-closed 边界，真实产物校验已接入 `check:builds`。 |
| P1 | 图片预览加载与可访问性 | 已完成：H5 预览只渲染当前原图，并在打开/切换时通过 `new window.Image()` 预加载左右相邻图片；缓存随 activeIndex 裁剪到当前图和相邻图，避免长图集一次性下载全部原图。图片库与图文渲染入口已通过 H5 原生 `button` 暴露触发器名称，Enter/Space 由浏览器默认按钮行为处理；静态测试锁定 `aria-label`、触发器传参和非全量渲染契约。2026-07-17 已把当前稳定 H5 产物写入 baseline，严格比较回到 0 变化；后续真实 H5 smoke 归档可继续补充网络请求数量证据。 | `npm.cmd run test:image-preview-accessibility`、`npm.cmd run check:core`、`npm.cmd run build:h5`、`npm.cmd run validate:h5-preview-bundle` 和 `npm.cmd run compare:h5-size -- --strict` 均通过；无需 runner 临时补 `tabindex` 即可通过键盘打开，关闭后焦点回到原触发器；后续若改预加载半径，必须同步更新缓存上限和长图集请求证据。 |
| P1 | H5 响应式按需加载 | 已完成：`WebSplitLayout` 使用 `matchMedia("(min-width: 1180px)")` 决定是否挂载评定 master，宽屏详情路由才 lazy 加载 `pages/evaluation`；窄屏详情路由使用稳定 inline detail 容器，不命中 `.web-split-layout` 选择器，也不挂载 `.web-split-layout__master`。2026-07-17 真实 H5 smoke 证明断点切换时图片库页不再重挂载丢失预览 state；runner diagnostics 已增强为分别记录移动、桌面和断点计数，390×844 下评定页、图片库页、图文编辑页和提交前预览页均为 `layoutShellCount=0`、`layoutMasterCount=0`，图片库页、图文编辑页和提交前预览页在 1280×844 均为双栏 1/1/1，在 1179×844 均为 `inlineDetailCount=1` 且 master 为 0，在 1180×844 均为双栏 1/1/1，全部 `scrollWidth` 等于 `clientWidth`，图片预览 `mobilePreviewNoOverflow=true`。后续重点是把同类 diagnostics 扩展到新增详情路由和更多真实浏览器通道，而不是只补截图。 | `npm.cmd run test:web-split-layout-responsive`、`npm.cmd run test:h5-smoke-runner`、`npm.cmd run test:h5-smoke-matrix`、`npm.cmd run smoke:h5:matrix -- --base-url http://127.0.0.1:10086 --browsers msedge --timeout-ms 10000`、`npm.cmd run check:core` 均通过；正式 H5 smoke 归档已保留移动/桌面/断点 diagnostics。 |
| P1 | H5 评定页工作区继续减量 | 路由 chunk 已过线，但 `route/pages/evaluation/index.js` 仍是当前最大资源；2026-07-17 sourcemap 归因显示 Top 仍集中在 Taro H5 API/polyfill、`ProofItem`、`UploadImageButton`、`useEvaluationStore` 和草稿工具。已试验把 `ProofItem` 或图片/图文低频服务继续 lazy 拆出：评定页主路由可降到约 198-214 KiB raw，但会新增 async chunk 并使 JS 总量超过严格阈值，因此本轮不保留。后续应优先从减少重复 Taro API 引入、合并共享 async chunk、或把 `ProofItem` 内部低频 UI 改为不重复创建运行时 chunk 入手。 | 开启 `H5_ANALYZE_SOURCEMAP=1` 构建后明确 Top 模块归因；若继续拆分，路由 JS 仍需保持低于 244 KiB，且 `compare:h5-size -- --strict` 不得因新增 async chunk 或总 JS 反弹失败。 |
| P2 | H5 断点矩阵扩容 | 当前 1179px / 1180px 断点已覆盖图片库页、图文编辑页和提交前预览页，且 1280px 桌面检查已证明三条详情流都能稳定进入双栏。后续若新增任何使用 `WebSplitLayout` 的详情路由，应同步补进 desktop 与 breakpoint diagnostics，避免只靠单页验证断点行为。 | 新增详情路由后，`test:h5-smoke-runner` 与 `test:h5-smoke-matrix` 的响应式计数断言要同步扩容，且新路由不得只在截图里“看起来正常”。 |
| P1 | H5 启动依赖精简 | 已完成：`src/utils/platform/index.h5.ts` 复用浏览器 `localStorage`、`navigator.userAgentData.platform` / `navigator.platform`，不导入 `@tarojs/taro` 且不调用 `getSystemInfoSync`；`src/utils/platform/index.ts` 保留小程序/RN 的 Taro 系统信息读取。2026-07-16 H5 构建后 `dist/h5/js` 已无 `getSystemInfoSync`，入口 `js/app.js` 相对旧 baseline 减少约 15.0 KiB raw / 6.0 KiB gzip / 5.4 KiB Brotli；2026-07-17 当前 H5 baseline 为入口 358.4 KiB raw / 112.2 KiB gzip / 96.8 KiB Brotli、JS 总量 1355.0 KiB raw / 403.3 KiB gzip / 342.0 KiB Brotli。 | `npm.cmd run test:platform-h5`、`npm.cmd run typecheck`、`npm.cmd run build:h5`、`npm.cmd run analyze:h5-size:json`、`npm.cmd run update:h5-size-baseline` 和 `npm.cmd run check:builds` 均通过。 |
| P1 | H5 入口资源减量 | 2026-07-16 `check:builds` 仍稳定出现 Webpack entrypoint 推荐阈值告警：`app` 入口约 358 KiB raw，由 `js/788` Taro runtime vendor、`js/app` 和 `css/app` 组成；单资源均低于 244 KiB，但入口合计仍偏大。开启 `H5_ANALYZE_SOURCEMAP=1` 后确认 `js/app` 主要来自 `@stencil/core`、`react-dom`、`history` 和路由依赖，`js/788` 主要来自 Taro components/router runtime。曾尝试把 `WebSplitLayout` 改为 H5 原生 `div` 分流，入口可降到约 332 KiB，但会使 Taro components 从公共入口迁移到多个路由 chunk，导致总 JS 增长且评定路由超过 244 KiB；因此该方向不保留。后续应优先从 Taro H5 runtime/API 按需能力、路由公共 chunk 策略或减少首屏 Taro component 依赖入手。 | 入口资源合计降到 244 KiB 推荐阈值附近，或在文档中明确保留告警的业务原因；`check:builds` 继续通过且不牺牲移动详情页按需加载，也不能让路由 chunk 或总 JS 反弹。 |
| P2 | 构建日志噪声治理 | 已处理一层文档兜底：多次 H5、小程序和 RN 构建都会提示 `C:\Users\39187\.taro-global-config\index.json` 不存在，目前不影响构建结果；README 和技术栈文档已说明这是用户级全局配置缺省提示，项目不依赖该文件，门禁以命令退出码和校验脚本为准。后续若仍影响阅读，可继续评估是否在本机初始化空配置或向 Taro CLI 侧收敛提示。 | 开发者不会把该提示单独当作失败项；真正失败仍由 `check:core`、`check:builds`、体积对比和目标校验脚本判定。 |
| P1 | WebSocket ACK | 客户端消息 ID、发送/接收 ACK、10 秒超时、断线失败、服务端时间、失败原因、尝试次数和手动重试已完成；后续需后端按 `api.md` 实现 `client:transferAck` / `server:transferAck` 转发、同消息 ID 幂等去重和离线目标失败响应。 | 发送失败不会被误判为已送达，历史记录可追踪状态；真实后端联调能返回最终 ACK。 |
| P1 | 草稿冲突 | 保存时间、来源位置、条目/材料/图片数量、总差异条目数、新旧判断和覆盖后果已完成；远端 `deviceName` 已支持可选展示。2026-07-16 新增按维度差异摘要和逐条差异预览，冲突提示会列出发生变化的维度、维度内变化条目数、本机/远端材料条数，以及前 5 个变化条目的标题、选择变化和材料变化。前端已预留 `draftVersion` 契约，兼容后端 `draftVersion` / `draft_version` / `version`，保存远端草稿时会带上当前版本并使用后端返回的新版本。后续由后端稳定返回设备名称和草稿版本，并可继续把逐条差异升级为弹窗内展开/收起明细。 | 用户选择保留版本前能看懂差异，不会静默覆盖；`npm.cmd run test:evaluation-draft` 覆盖草稿版本、维度差异与逐条差异摘要；后端接入后能识别具体远端设备并避免版本并发误判。 |
| P1 | 图片体验 | 短文件名、缩略图及占位、独立失败原因、完整逐张状态、单张重传和移除已完成；首张失败时尚未执行的后续图片会正确显示“待重试”，不会误报为真实失败。H5 QA 发现并修复了双栏工作区内图片库筛选区固定列宽导致“排序”控件被裁切的问题，现按容器宽度自动换列。后续需后端返回稳定上传错误码、缩略图尺寸和可恢复/不可恢复标识，以决定是否允许重试。 | 多图上传中成功、失败、取消、待重试和重传状态清晰可见；未尝试图片不会被误报失败；筛选控件不横向溢出。 |
| P1 | 材料资产 | 前端已为图文补齐标签、关联维度、来源、引用次数、最近使用时间和最近评定位置，覆盖本地缓存、远端请求、流转、列表检索与引用快照；图片既有使用统计保持不变。新增旧缓存兼容和资产元数据测试。后续需后端持久化这些字段、提供真正稳定的材料 ID，并把使用统计从仅本机累计升级为跨设备原子计数。 | 标签和维度可编辑、检索并跨设备保留；引用后统计与最近上下文更新；删除原材料不破坏提交快照；后端联调后多设备看到一致统计。 |
| P1 | 材料资产检索 | 当前前端可按标题、正文、标签和维度名称搜索本地缓存；后续由后端支持标签/维度/来源筛选、最近使用排序和分页，并明确空数组是“主动清空”还是“字段缺省”，避免元数据合并无法区分两种语义。 | 大材料库下无需全量下载即可组合筛选；清空标签或维度后不会因旧缓存合并而恢复。 |
| P1 | RN 验收 | Android Bundle 已成功生成，10 条应用样式警告已清零，通配符/元素选择器与非法字重的静态回归检查已接入 `check:core`，预检证据已归档；当前机器缺少 Android 运行环境，后续需在真机或模拟器补齐首页、评定填报、图片库、预览、提交结果和提交历史 smoke。 | RN Bundle 不只验证产物存在，还验证核心页面可读可操作；应用自有样式警告保持为 0。 |
| P2 | 审核统计 | 2026-07-16 已完成前端审核统计工具和后台面板接入：按当前筛选记录汇总班级提交率、待处理数量、退回数量、平均分、材料完成度、平均材料数、维度平均得分、分数缺口、材料数、问题数和高风险维度；口径测试已接入 `check:core`。后续由后端提供同筛选口径的 `GET /evaluation-submissions/stats`，并支持按班级、状态、时间和关键字聚合，避免大班级全量拉取后再本地统计。 | `npm.cmd run test:review-stats` 和 `npm.cmd run check:core` 通过；学生和审核人员能快速识别风险维度和待处理记录；后端接入后统计接口与列表/导出口径一致。 |
| P2 | 数据导出 | 2026-07-16 已完成提交记录 CSV 生成工具和后台导出按钮，字段覆盖提交编号、学生、班级、提交时间、规则版本、审核状态、总分、材料数、问题数、五维得分、审核意见、退回原因、审核人和审核时间；CSV 转义、中文状态、五维得分、文件名、H5 Blob 下载和非 H5 剪贴板兜底已有测试覆盖。当前前端导出当前筛选结果；后续由后端提供同字段、同筛选口径的异步导出接口，避免大数据量阻塞主页面。 | `npm.cmd run test:submission-export` 通过；导出字段与后台审核记录/提交记录页面口径一致；H5 可直接下载，非 H5 可复制 CSV；后端接口接入后大数据量导出不阻塞前端。 |
| P2 | 监控埋点 | 2026-07-17 已完成前端本地监控口径：统一事件包含类型、名称、状态、接口、状态码、消息、时间和上下文；接口失败按 `METHOD path status` 聚合，关键操作按 `action:status` 计数，错误日志可关联 scope 和上下文。当前已接入 `request`、远端草稿保存、正式提交和草稿保存结果；工具层已默认脱敏用户标识、正文、图片 URL、长字符串和常见密钥字段，并提供 `schemaVersion=1` 的批量上报 payload、`droppedEventCount`、上报服务和按事件 ID 清理已上传事件能力。未配置 API 或上报失败时会保留待上报事件，并记录上报错误。后续需后端提供批量上报接口、采样策略、服务端二次脱敏和线上查询看板。 | `npm.cmd run test:monitoring`、`npm.cmd run test:monitoring-service` 与 `npm.cmd run typecheck` 通过；后续接入上报端点后，线上异常可追踪到接口、页面、用户动作和时间，且不得上传正文、证明材料或图片 URL 等敏感内容。 |

## 后端/API 配合点

| 能力 | 契约方向 |
| --- | --- |
| 正式提交 | 创建提交、提交详情、提交状态、提交时规则版本和完整材料快照。 |
| 草稿同步 | 远端快照稳定返回保存时间、可选 `deviceName` 和 `draftVersion`；保存草稿时接收前端传入的当前版本，并返回保存后的新版本，以支持更可靠的并发冲突检测；失败响应建议返回稳定 `code` 和可读 `message`，前端会优先按错误码和 HTTP 状态码分类同步失败。 |
| 审核流转 | 审核列表、审核详情、状态更新、审核意见、退回原因、审核人和审核时间。 |
| 权限角色 | 登录响应返回 `role`，并在审核列表、审核详情、状态更新和导出接口上做服务端权限校验。 |
| 批量审核 | 按班级、状态、提交时间、问题数量、学生关键词分页查询。 |
| 材料复用 | 图文材料、图片、评定记录之间的稳定引用 ID 和快照索引；图文持久化 `tags`、`dimension_keys`、`source`、`used_count`、`recent_used_at` 与最近使用上下文，并提供跨设备原子使用计数接口。 |
| 图片上传 | 稳定图片 ID、缩略图、尺寸、大小、可访问 URL 和失败错误码。 |
| 规则版本 | 评分规则版本、启用时间、发布状态、回滚能力和提交记录关联规则版本。 |
| WebSocket | 消息 ID、ACK、失败原因、服务端时间、设备在线状态和重连恢复。 |
| 导出统计 | 统计查询应与 `src/utils/reviewStats.ts` 保持一致；导出任务创建、导出进度、导出文件下载和权限校验；CSV 字段建议与 `src/utils/submissionExport.ts` 保持一致。 |
| 监控上报 | 批量接收前端监控事件，支持接口失败聚合、关键操作漏斗、错误日志查询、脱敏字段校验、服务端二次脱敏、采样和限流；建议接口为 `POST /frontend-monitoring-events`，返回已接受事件 ID，前端当前事件口径见 `src/utils/monitoring.ts`、`src/services/monitoringService.ts` 与 `docs/api.md`。 |

## 合并前检查建议

日常开发完成后优先执行：

```bash
npm.cmd run check:core
```

涉及跨端构建时执行：

```bash
npm.cmd run check:builds
```

需要完整检查时执行：

```bash
npm.cmd run check:all
```

H5 验收记录建议流程：

```bash
npm.cmd run smoke:h5:run -- --base-url http://localhost:10086 --out output/smoke/h5-results.json
npm.cmd run smoke:h5:finalize -- --results output/smoke/h5-results.json --out output/smoke/h5-smoke.md
```

RN 验收记录建议流程：

```bash
npm.cmd run smoke:rn:results -- --out output/smoke/rn-results.json
npm.cmd run smoke:rn:finalize -- --results output/smoke/rn-results.json --out output/smoke/rn-smoke.md
```
