# 开发规范

本文档沉淀二课系统前端团队开发约定。目标是在跨端前提下保持代码可读、模块边界清晰、接口访问统一、样式和组件可复用。

## 基本原则

- 默认使用项目自定义组件和既有模块，不重复造相同能力。
- 优先使用 Taro 跨端 API，避免直接使用只适配 H5 或只适配 RN 的运行时能力。
- 业务页面负责组合和交互，复杂状态与副作用下沉到 store 或 services。
- 类型先行，涉及接口、流转消息、图文内容和评定记录时必须维护领域类型。
- 文档、接口、类型和实现要同步更新。

## 目录职责

| 目录 | 规范 |
| --- | --- |
| `src/pages` | 只放路由页面，每个页面目录包含 `index.tsx` 和必要的 `index.scss`；页面私有组件和 hooks 可放在页面目录下的 `components`、`hooks` |
| `src/components` | 放可复用业务组件，组件目录使用 PascalCase |
| `src/stores` | 放 Zustand store，文件名使用 `useXxxStore.ts` |
| `src/services` | 放登录、接口、评定草稿、图文材料、图片库、提交记录、上传、WebSocket、流转等副作用封装 |
| `src/types` | 放领域类型，不放业务实现 |
| `src/data` | 放静态业务配置，如评定维度和计分配置 |
| `src/utils` | 放无业务状态的通用工具 |
| `docs` | 放项目说明、接口约定和技术规范 |
| `config` | 放 Taro 构建配置 |

新增代码应放入最接近职责的目录。不要为了方便在页面内堆叠请求、状态计算和协议转换。

## 命名规范

- 页面目录使用业务语义命名，例如 `evaluation`、`login`、`note/edit`。
- 组件目录使用 PascalCase，例如 `TransferButton`。
- store 文件使用 `useXxxStore.ts`，导出同名 hook。
- 类型文件按领域命名，例如 `evaluation.ts`、`content.ts`、`transfer.ts`。
- 服务文件按能力命名，例如 `api.ts`、`upload.ts`、`websocket.ts`。
- 业务 ID、Storage Key、事件名等常量应集中定义在使用模块顶部，避免散落魔法字符串。

## 页面开发规范

- 新增页面必须同步注册到 `src/app.config.ts`。
- 页面组件只保留页面编排、用户交互和必要的生命周期逻辑。
- 需要跨页面复用的 UI 提取到 `src/components`。
- 只服务单一复杂页面的局部 UI 可放入该页面目录下的 `components`，例如评定页工作区、概览和操作栏。
- 页面内复用的数据组织、提交动作和流转提示可放入该页面目录下的 `hooks`。
- 需要跨页面共享的数据放入 `src/stores`。
- 需要访问接口、上传、WebSocket 或本地持久化的复杂流程，优先封装到 `src/services` 或 store action。

## 组件开发规范

- 前端设计默认使用项目自定义组件。
- 组件应通过 props 接收数据和回调，不直接读取不相关 store。
- 组件样式与组件同目录维护，命名为 `index.scss`。
- 组件应尽量保持跨端兼容，不依赖浏览器专属 DOM API。
- 组件内文字、按钮和状态展示应服务业务含义，避免加入说明式冗余文案。

## 状态管理规范

- Zustand store 按业务域拆分，不建立无边界大 store。
- store action 负责维护自身状态的一致性，例如评定计分、草稿恢复、图文保存状态。
- 本地持久化通过 Taro Storage API 实现。
- 从 Storage 读取的数据要有兜底逻辑，避免异常导致页面不可用。
- 跨 store 协作应通过明确的 service 函数组织，例如 `transferService.ts`。

## 接口与服务规范

- REST 请求统一走 `src/services/api.ts` 的 `request` 封装。
- 登录统一走 `src/services/authService.ts`。
- 评定快照、草稿远端保存和正式提交统一走 `src/services/evaluationService.ts`。
- 图文材料列表和详情统一走 `src/services/noteService.ts`。
- 图片库列表和上传后缓存统一走 `src/services/imageLibraryService.ts`。
- 提交摘要和提交历史统一走 `src/services/submissionService.ts`。
- 图片上传统一走 `src/services/upload.ts`。
- WebSocket 连接统一由 `src/services/websocket.ts` 管理。
- 业务流转统一通过 `src/services/transferService.ts` 发起或应用。
- 页面和组件不直接拼接 `API_BASE_URL`、`WS_BASE_URL` 或 Authorization Header。
- 接口失败时应给用户明确反馈；草稿类操作允许本地兜底，提交类操作不能假成功。
- 接口字段、Storage Schema、WebSocket 事件以 [api.md](./api.md) 为准。

## 类型规范

- 评定相关类型维护在 `src/types/evaluation.ts`。
- 登录相关类型维护在 `src/types/auth.ts`。
- 图文内容相关类型维护在 `src/types/content.ts`。
- 提交记录相关类型维护在 `src/types/submission.ts`。
- 跨设备流转相关类型维护在 `src/types/transfer.ts`。
- 接口响应如果存在蛇形字段和驼峰字段兼容，应在服务层归一化，不把兼容逻辑扩散到页面。
- 新增流转动作时，需要同步更新类型、WebSocket 处理、发送入口和接收应用逻辑。

## 样式规范

- 样式使用 SCSS，页面或组件样式与对应 TSX 同目录。
- 保持 Taro 多端可编译，谨慎使用 H5 专属选择器和布局特性。
- 优先使用明确的类名表达业务区域。
- 不在全局 `app.scss` 中堆放页面私有样式。
- 修改公共样式前需要确认 H5、小程序和 RN 的影响范围。

## 跨端兼容规范

- 平台识别统一使用 `src/utils/platform.ts` 中的工具。
- 设备 ID 和设备名称由启动阶段初始化，不在页面内重复生成。
- 图片选择使用 Taro `chooseImage`。
- 网络请求使用 Taro `request`。
- 文件上传使用 Taro `uploadFile`。
- WebSocket 使用 Taro `connectSocket`。
- Storage 使用 Taro Storage API。

如确实需要平台分支，分支逻辑应集中在工具层或服务层，避免分散在多个页面组件中。

## 命令规范

终端使用 PowerShell。运行 npm 命令时必须使用 `npm.cmd`，不要直接调用 `npm`。

常用命令：

```powershell
npm.cmd install
npm.cmd run dev:h5
npm.cmd run dev:weapp
npm.cmd run dev:rn
npm.cmd run build:h5
npm.cmd run build:weapp
npm.cmd run build:rn
npm.cmd run typecheck
```

新增脚本后，应同步更新 `package.json`、`README.md` 或相关 docs，确保团队可以按文档运行。

## 文档维护规范

- 新增接口或事件时，更新 `docs/api.md`。
- 新增页面、store、service 或重要组件时，更新架构文档。
- 新增依赖、运行脚本、目标平台或语言约定时，更新技术栈文档。
- 调整团队约定时，更新本文档。
- 文档中涉及版本号时，以 `package.json` 当前内容为准。
