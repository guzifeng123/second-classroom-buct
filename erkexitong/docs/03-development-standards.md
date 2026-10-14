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
- 新增页面必须同步更新 `scripts/utils/page-matrix.js`，声明页面名称、页面类型（`shell`、`detail`、`status`）和是否纳入 smoke 覆盖。
- 新增页面必须同步更新 `docs/00-index.md`、`docs/01-framework-architecture.md`，并按页面类型补充 H5/RN smoke 清单。
- 新增页面默认需要提供同目录 `index.scss` 和 `index.rn.scss`；确实不需要 RN 样式时，应先调整页面矩阵校验规则并说明原因。
- RN 样式只使用 class 选择器，禁止通配符和 `View`、`Text`、`Button` 等元素选择器；`font-weight` 只使用 `normal`、`bold` 或 100-900 整百值。提交前运行 `npm.cmd run validate:rn-styles`。
- 公共业务源码保持 Metro 0.72 与 React Native 0.70/Hermes 可运行的 ES2019 语法；数值常量不要使用 `60_000` 这类数字分隔符，数组末项不要依赖 `Array.prototype.at`，避免 TypeScript/H5 通过但 RN 构建或运行失败。提交前运行 `npm.cmd run validate:rn-source`。
- 同一页面同时使用公共 `components/ui` 与带独立样式的业务组件时，先导入公共 UI，再导入业务组件，并在所有页面保持一致顺序，避免微信小程序 `mini-css-extract-plugin` 产生冲突顺序警告。
- 页面组件只保留页面编排、用户交互和必要的生命周期逻辑。
- 需要跨页面复用的 UI 提取到 `src/components`。
- 只服务单一复杂页面的局部 UI 可放入该页面目录下的 `components`，例如评定页工作区、概览和操作栏。
- 页面内复用的数据组织、提交动作和流转提示可放入该页面目录下的 `hooks`。
- 需要跨页面共享的数据放入 `src/stores`。
- 需要访问接口、上传、WebSocket 或本地持久化的复杂流程，优先封装到 `src/services` 或 store action。

## 组件开发规范

- 前端设计默认使用项目自定义组件。
- 组件应通过 props 接收数据和回调，不直接读取不相关 store。
- 组件样式与组件同目录维护，通用样式命名为 `index.scss`；平台专属实现可使用 `index.h5.scss`、`index.rn.scss` 等同名平台后缀。
- 组件应尽量保持跨端兼容，不依赖浏览器专属 DOM API。
- 已知平台运行时差异应封装在项目自定义组件或工具中。受控多行输入统一使用 `StableTextarea`，页面不得直接复制 H5 原生 `textarea` 分支或修改 `node_modules`。
- 图片预览统一使用 `ImagePreview`。页面和内容渲染器不得直接调用 `Taro.previewImage`、引入 Swiper 或复制灯箱状态；浏览器 Portal、原生 DOM、键盘与焦点处理只放在 `.h5.tsx` 实现中，小程序和 RN 由基础实现调用 Taro API。
- 组件内文字、按钮和状态展示应服务业务含义，避免加入说明式冗余文案。

## 状态管理规范

- Zustand store 按业务域拆分，不建立无边界大 store。
- store action 负责维护自身状态的一致性，例如评定计分、草稿恢复、图文保存状态。
- 本地持久化通过 Taro Storage API 实现。
- 从 Storage 读取的数据要有兜底逻辑，避免异常导致页面不可用。
- 图文和图片等材料资产的标签、关联维度、来源与使用统计必须在归一化层补默认值；远端响应缺少可选元数据时按稳定 ID 合并本机缓存，不能静默清空已有统计。
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
- 登录角色、角色文案和入口权限判断维护在 `src/utils/authPermissions.ts`，页面只消费 `canAccessAdminMode` 等明确工具函数。
- 图文内容相关类型维护在 `src/types/content.ts`。
- 图文材料来源等资产元类型维护在 `src/types/note.ts`。
- 提交记录相关类型维护在 `src/types/submission.ts`。
- 跨设备流转相关类型维护在 `src/types/transfer.ts`。
- 接口响应如果存在蛇形字段和驼峰字段兼容，应在服务层归一化，不把兼容逻辑扩散到页面。
- 图文标签统一经 `normalizeNoteTags` 处理，最多 6 个、单个最多 12 字；关联维度统一经 `normalizeNoteDimensionKeys` 校验，不在页面或 store 内复制约束常量。
- 评定记录引用材料时必须保存不可变引用快照；原材料删除、重命名或后续修改不得破坏已保存和已提交记录的回看内容。
- 新增流转动作时，需要同步更新类型、WebSocket 处理、发送入口和接收应用逻辑。
- 真实流转必须携带稳定 `messageId`，Socket 写入成功只能进入“等待确认”；只有合法服务端 ACK 才能标记“已送达”。重试复用原消息 ID，并保留失败原因、尝试次数和服务端时间。

## 样式规范

- 样式使用 SCSS，页面或组件样式与对应 TSX 同目录。
- 保持 Taro 多端可编译，谨慎使用 H5 专属选择器和布局特性。
- 优先使用明确的类名表达业务区域。
- 不在全局 `app.scss` 中堆放页面私有样式。
- 修改公共样式前需要确认 H5、小程序和 RN 的影响范围。
- CSS `display: none` 只隐藏视图，不代表代码或数据未加载；移动端不需要的宽屏 master、重型编辑器和预览依赖必须在组件树或动态导入层真正按需加载。
- H5 详情页双栏统一由 `WebSplitLayout` 控制，只有 `matchMedia("(min-width: 1180px)")` 命中时才能挂载评定 master；移动详情路由不得提前 import 或渲染评定页作为隐藏侧栏。调整该逻辑时同步更新 `test:web-split-layout-responsive` 和 H5 smoke 的 390×844 无 master 断言。
- 非路由手写 `import()` 应使用唯一、语义化、kebab-case 的 `webpackChunkName`，避免依赖 Webpack deterministic 数字 ID；已由 Taro 页面加载器映射成 `route/pages/...` logicalKey 的路由 chunk 不重复强制命名。构建门禁只检查已知手写 lazy key，不能误把框架和公共依赖生成的数字 chunk 一律判错。
- H5 体积变更应同时记录 raw、gzip 和 Brotli，并通过 `npm.cmd run compare:h5-size -- --strict` 检查受控 baseline；sourcemap 只用于本地模块归因，不随生产产物发布，也不得用于生成 baseline。
- H5 图片预览产物必须通过 `npm.cmd run validate:h5-preview-bundle`：`dist/h5/js` 全量不得出现 `taro-swiper-core`、`defineCustomElementTaroSwiper`、`swiper-container-` 或 `data-swiper-slide-index`，图片库路由 JS raw 必须严格小于 `249856` B。源码未显式导入 Swiper 不能替代产物校验。
- `scripts/baselines/h5-size.json` 只能在确认体积变化符合预期后通过 `npm.cmd run update:h5-size-baseline` 显式更新。普通分析、测试和构建检查不得自动覆盖 baseline；更新时应在变更说明中记录三尺寸差值与原因。

## 跨端兼容规范

- 平台识别统一使用 `src/utils/platform/index.ts` 与 `src/utils/platform/index.h5.ts` 中的工具，H5 入口优先命中浏览器轻量实现。
- 设备 ID 和设备名称由启动阶段初始化，不在页面内重复生成。
- 图片选择使用 Taro `chooseImage`。
- 网络请求使用 Taro `request`。
- 文件上传使用 Taro `uploadFile`。
- WebSocket 使用 Taro `connectSocket`。
- Storage 使用 Taro Storage API。
- 平台专属组件使用同名基础入口和 `.h5.tsx`、`.rn.tsx` 等平台文件，公共 props 契约保持一致；浏览器 DOM API 只能出现在 H5 实现中。

如确实需要平台分支，分支逻辑应集中在自定义组件、工具层或服务层，避免分散在多个页面组件中。

## Smoke 与证据规范

- H5 可交互结论必须来自真实浏览器；`--static-only` 只做入口和源码预检，所有步骤只能标记“跳过”，不能冒充交互通过。
- smoke 的“通过/失败”必须填写备注并至少关联截图或日志；“跳过”必须写明环境或依赖原因。
- 证据路径必须位于项目内、真实存在且为文件；正式归档前运行 `validate:smoke-results` 和对应 `smoke:*:finalize`。
- 浏览器 console error、page error、流程中断和响应式横向溢出必须使实际所属步骤失败；不得统一归到登录页，也不得被后续“跳过”覆盖。
- 图片预览 smoke 至少覆盖首次直达未加载禁用的 Swiper 标记、带可访问名称的原生按钮触发器、Enter/Space 打开预览、切换下一张、计数更新、Escape 关闭和焦点回到触发图片；只检查 DOM 标记或只通过 bundle 静态校验不能替代真实交互。
- 涉及渲染交互的修复不能只验证构建，需要复跑目标流程并检查桌面、390×844 移动视口、控制台和截图。

## 命令规范

终端使用 PowerShell。运行 npm 命令时必须使用 `npm.cmd`，不要直接调用 `npm`。Node/npm 必须与 `.node-version`、`engines`、`packageManager` 和 `devEngines` 的精确版本一致；提交前可运行 `npm.cmd run check:runtime` 核对。

常用命令：

```powershell
npm.cmd ci
npm.cmd run check:runtime
npm.cmd run dev:h5
npm.cmd run dev:weapp
npm.cmd run dev:rn
npm.cmd run build:h5
npm.cmd run build:weapp
npm.cmd run build:rn
npm.cmd run typecheck
```

只有主动增删依赖或同步 package 根元数据时才运行 `npm.cmd install` 并提交生成的 lock 变化；普通拉取、CI 和验证统一使用 `npm.cmd ci`。Node/npm 升级必须作为显式工具链变更，同时更新版本声明、重跑三端构建和 H5 baseline，不得静默使用其他版本生成报告。

H5、微信小程序和 RN 构建产物必须分别保留在 `dist/h5`、`dist/weapp`、`dist/rn`；新增构建脚本不得复用并清空其他目标的输出目录。

`check:builds` 的 H5 阶段必须在同一固定 profile 下连续执行两次干净构建，并比较除根 `generatedAt` 外的完整体积报告；path、logicalKey、raw/gzip/Brotli 或稳定 lazy key 任一漂移都应失败。真实双构建留在构建门禁，fixture comparator 测试进入 `check:core`，避免日常核心测试承担两次构建成本。

Windows 环境变量名按大小写不敏感处理。固定 H5 profile 必须通过共用环境构造器清除所有大小写形式的 `H5_SIZE_*`、`H5_ANALYZE_SOURCEMAP`、`H5_PREVIEW_BUNDLE_DIST_ROOT`、`NODE_ENV`、`TARO_APP_API_BASE_URL` 和 `TARO_APP_WS_BASE_URL`，不得只删除大写拼写后直接继承父进程环境。

新增脚本后，应同步更新 `package.json`、`README.md` 或相关 docs，确保团队可以按文档运行。

## 文档维护规范

- 新增接口或事件时，更新 `docs/api.md`。
- 新增页面、store、service 或重要组件时，更新架构文档。
- 新增依赖、运行脚本、目标平台或语言约定时，更新技术栈文档。
- 调整团队约定时，更新本文档。
- 文档中涉及版本号时，以 `package.json` 当前内容为准。
