# 框架与架构规范

本文档说明二课系统前端的框架结构、模块职责和主要数据流。当前工程是基于 Taro 的跨端前端应用，不包含后端服务实现。

## 总体架构

项目采用 Taro 3 + React + TypeScript 架构，以 `src` 作为源码根目录，通过 Taro 编译到 H5、微信小程序和 React Native。业务代码尽量使用 Taro 提供的跨端 API 和项目自定义组件，减少直接依赖单一端能力。

整体分层如下：

| 层级 | 目录 | 职责 |
| --- | --- | --- |
| 应用入口 | `src/app.tsx`、`src/app.config.ts` | 初始化应用、注册页面、设置窗口配置、恢复登录会话与设备信息 |
| 页面层 | `src/pages` | 承载路由页面和业务流程 |
| 组件层 | `src/components` | 提供可复用业务组件 |
| 状态层 | `src/stores` | 使用 Zustand 管理登录、评定、图文、连接和流转状态 |
| 服务层 | `src/services` | 封装 REST 请求、登录、评定草稿、图文材料、图文快照预览、图片库、提交记录、图片上传、WebSocket 和跨设备流转 |
| 类型层 | `src/types` | 维护登录、评定、图文内容、提交记录、流转消息等领域类型 |
| 数据配置 | `src/data` | 维护综合素质评定维度、项目、计分规则等静态配置 |
| 工具层 | `src/utils` | 提供平台识别、设备 ID、通用 ID 生成、评分计分、提交前校验、草稿归一化、图文材料归一化、图文快照展示、图片库归一化、上传响应归一化和提交记录归一化等工具 |

## 页面结构

页面由 `src/app.config.ts` 注册，当前包含：

| 页面 | 路径 | 主要职责 |
| --- | --- | --- |
| 登录页 | `pages/login/index` | 用户 ID 登录、离线演示模式标识、设备识别、初始化会话 |
| 评定页 | `pages/evaluation/index` | 综合素质评定填报、实时计分、草稿暂存、远端同步、材料流转、提交触发 |
| 提交前预览页 | `pages/evaluation/preview/index` | 汇总分数、材料数量、待完善问题和材料明细，提交前复核 |
| 图文材料列表页 | `pages/note/list/index` | 搜索、查看、新建和继续编辑图文材料，支持远端读取失败后的本地缓存兜底 |
| 图文编辑页 | `pages/note/edit/index` | 图文材料标题、文字块、图片块编辑、预览、保存与流转 |
| 图文快照页 | `pages/note/snapshot/index` | 只读展示评定记录或提交结果中保留的图文引用快照，优先渲染内容块快照，旧数据用摘要兜底 |
| 图片库页 | `pages/image/library/index` | 查看、上传、筛选和预览证明图片，支持远端读取失败后的本地缓存兜底 |
| 提交结果页 | `pages/submission/result/index` | 展示提交编号、提交摘要、维度得分和材料统计 |
| 提交历史页 | `pages/submission/history/index` | 查看当前用户提交记录、审核状态和退回原因，支持远端读取失败后的本地记录兜底 |
| 状态说明页 | `pages/error/index` | 展示离线、同步不可用和入口错误等状态说明 |

新增页面时必须先确认路由是否需要写入 `src/app.config.ts`，再按页面目录约定新增 `index.tsx` 和对应样式文件。

## 组件结构

组件统一放在 `src/components`，当前主要组件包括：

| 组件 | 职责 |
| --- | --- |
| `EvaluationPanel` | 综合素质评定维度与条目的折叠面板 |
| `ProofItem` | 单条证明材料的文字、图片和选项编辑 |
| `TransferButton` | 发起跨设备内容流转 |
| `UploadImageButton` | 图片选择、本地预览或直接上传入口 |
| `NoteContentRenderer` | 图文内容块渲染 |
| `WebSplitLayout` | H5 宽屏双栏布局容器 |

前端开发默认优先使用项目已有自定义组件。只有在现有组件无法表达新业务，并且抽象具有复用价值时，才新增组件。

## 状态管理

项目使用 Zustand 作为状态管理方案。每个 store 聚焦一个业务域，避免把所有状态放入单一全局 store。

| Store | 职责 |
| --- | --- |
| `useUserStore` | 登录态、用户 ID、token、设备 ID、设备名称、本地会话恢复 |
| `useEvaluationStore` | 评定记录、草稿读写、计分、必填校验、评定材料应用和草稿同步状态 |
| `useNoteStore` | 图文材料草稿、服务端读写、图文流转内容应用 |
| `useConnectionStore` | WebSocket 连接状态、重连次数、在线设备列表 |
| `useTransferStore` | 收到的流转内容、发送和接收历史 |

本地持久化通过 Taro Storage API 实现，使用跨端兼容的 `Taro.getStorage`、`Taro.setStorage`、`Taro.getStorageSync` 和 `Taro.setStorageSync`。

## 服务层与接口边界

服务层统一放在 `src/services`：

| 文件 | 职责 |
| --- | --- |
| `api.ts` | 封装 `Taro.request`，统一 API Base URL、JSON Header、Bearer token、错误归一化和离线模式判断 |
| `authService.ts` | 封装登录请求和离线登录模式判断 |
| `evaluationService.ts` | 封装评定快照读取、草稿远端保存和正式提交 |
| `noteService.ts` | 封装图文材料列表、详情、远端读取失败后的本地索引缓存和搜索 |
| `noteSnapshotService.ts` | 封装图文引用快照预览写入、最近快照兜底、快照索引维护和旧快照清理 |
| `imageLibraryService.ts` | 封装图片库列表、上传后缓存和远端读取失败后的本地图片兜底 |
| `submissionService.ts` | 封装提交记录本地保存、远端列表读取和结果详情读取 |
| `upload.ts` | 封装图片选择、上传、上传进度回调、取消句柄、上传响应归一化和证明图片转换 |
| `websocket.ts` | 封装 `Taro.connectSocket` 单例客户端、认证、入房、心跳、重连和消息分发 |
| `transferService.ts` | 封装跨设备流转初始化、停止、发送、接收应用和应用前确认 |

REST API、Storage Schema 和 WebSocket 事件结构以 [api.md](./api.md) 为准。业务页面不应直接拼接底层请求逻辑，应通过服务层函数访问接口。

## 数据流转

评定数据的典型流向：

1. 页面从 `useEvaluationStore` 读取评定配置对应的记录。
2. 用户编辑文字、图片、选项或数值后，页面调用 store action 更新状态。
3. 计分逻辑通过 `src/utils/evaluationScoring.ts` 根据 `src/data/evaluationConfig.ts` 和记录内容计算。
4. 草稿通过 `src/utils/evaluationDraft.ts` 补齐默认记录、合并已选条目和判断有效内容后，使用 Taro Storage 写入本地，并在已配置后端地址时同步到远端草稿接口。
5. 提交前进入预览页，按维度汇总得分、材料数量和校验问题；校验问题由 `src/utils/evaluationValidation.ts` 统一生成。
6. 正式提交前上传本地证明图片，`evaluationService.submitEvaluation` 成功后生成本地提交摘要并跳转结果页。
7. 如需跨设备同步，`TransferButton` 调用 `transferService` 发送流转消息。

提交记录读取时，`submissionService.ts` 通过 `src/utils/submissionNormalization.ts` 兼容后端驼峰字段、蛇形字段和本地旧缓存缺省字段，避免兼容逻辑扩散到页面。审核后台使用 `ReviewStatus` 统一表示未提交、待审核、审核中、已通过、退回补充和已归档状态，状态文案由 `src/utils/reviewStatus.ts` 维护，并支持按审核状态筛选记录列表、按最新提交、问题数量和分数排序。提交记录包含审核意见、退回原因、审核人和审核时间时，后台列表会直接展示。

学生端评定页和提交历史页同样读取 `ReviewStatus`、审核意见和退回原因；存在退回补充记录时展示提醒和返回评定页的补充入口，评定页会在填报模式顶部提示最近一次退回原因。

图文材料的典型流向：

1. 图文编辑页读写 `useNoteStore` 中的标题和内容块。
2. 内容块类型由 `src/types/content.ts` 定义，包括标题、段落、图片和扩展块。
3. 保存时优先写入本地草稿，再尝试调用服务端 `notes` 接口；远端失败时写入本地图文索引。
4. 列表页通过 `noteService.fetchNotes` 优先读取远端，失败时回退本地索引。
5. 跨设备收到 `NOTE_CONTENT` 时，由 `useNoteStore.applyIncomingContent` 应用。

图文材料列表、详情和本地缓存通过 `src/utils/noteNormalization.ts` 统一归一化，兼容后端 `plain_text`、`created_at`、`updated_at` 等字段，并统一生成纯文本摘要、内容块数量和图片数量。

评定条目可引用图文材料，引用时会把图文标题、摘要、图片数量、引用时间和可用的内容块保存为 `ProofRecord.noteReferences` 快照，并把摘要带入文字说明；引用卡片支持查看原图文材料，打开前会校验原材料是否仍可读取，失败时保留快照并提示用户。填报页和提交结果页通过 `pages/note/snapshot/index` 只读展示快照，避免原图文后续修改影响已提交记录。

图片库列表、上传缓存和评定条目图片复用通过 `src/utils/imageLibraryNormalization.ts` 统一归一化，兼容后端图片 URL、缩略图、上传时间、使用次数和最近使用上下文字段，并提供 `ProofImage` 转换。图片库页面支持按 URL 来源、最近关联维度和引用状态筛选图片资产，支持按上传时间、最近使用和大小排序，并会本地保存筛选偏好。

图片选择预检、上传进度、上传取消、上传响应解析、本地图片和已上传图片的 `ProofImage` 转换通过 `src/services/upload.ts` 与 `src/utils/uploadNormalization.ts` 统一处理，避免上传服务、评定页和图片库重复维护附件字段兼容逻辑。

## 跨设备流转

跨设备流转基于 WebSocket：

- 连接参数来自登录态和设备信息。
- 建连后发送 `auth` 和 `join` 事件。
- 客户端发送 `client:transfer`。
- 服务端返回 `server:stateUpdate` 和 `server:deviceList`。
- 心跳事件使用 `ping` / `pong`。
- 最大重连次数和心跳间隔由 `src/services/websocket.ts` 内部常量控制。

流转动作当前包含评定条目编辑 `EDIT_ITEM` 和图文材料 `NOTE_CONTENT`。新增动作时，应先扩展 `src/types/transfer.ts`，再扩展服务层和页面消费逻辑。

## 本地缓存与离线兜底

项目在未配置 `TARO_APP_API_BASE_URL` 时进入离线演示模式。离线模式允许登录、评定填报、本地草稿、图文材料本地保存和部分列表查看，但不允许正式提交、远端图片上传和跨设备同步。

当前主要本地缓存键：

| Key | 所属模块 | 内容 |
| --- | --- | --- |
| `erkexitong-session` | `useUserStore` | 登录态、用户 ID、token、设备 ID、设备名称和认证模式 |
| `erkexitong-evaluation-draft` | `useEvaluationStore` | 评定记录、已选项目和保存时间 |
| `erkexitong-note-draft` | `useNoteStore` | 当前图文编辑草稿 |
| `erkexitong-note-index` | `noteService` | 图文材料本地索引与详情缓存 |
| `erkexitong-note-snapshot-preview` | `noteSnapshot` | 最近一次打开的图文引用快照兼容兜底 |
| `erkexitong-note-snapshot-preview:<noteId-time>` | `noteSnapshot` | 单个图文引用快照的只读详情页数据 |
| `erkexitong-note-snapshot-preview:index` | `noteSnapshotService` | 最近图文引用快照索引，默认保留 24 条并清理更旧快照 |
| `erkexitong-image-library` | `imageLibraryService` | 图片库本地缓存 |
| `erkexitong-image-library-filters` | 图片库页 | 图片库筛选和排序偏好 |
| `erkexitong-submission-history` | `submissionService` | 本地提交摘要历史 |
