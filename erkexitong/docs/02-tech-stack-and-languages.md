# 技术栈与语言规范

本文档总结二课系统前端当前使用的技术栈、语言、构建工具和运行命令。版本信息以 `package.json` 为准。

## 核心技术栈

| 分类 | 技术 | 当前版本或说明 |
| --- | --- | --- |
| JavaScript 运行时 | Node.js | `24.14.1`，由 `.node-version`、`engines` 和 `devEngines` 固定 |
| 包管理器 | npm | `11.11.0`，由 `packageManager`、`engines` 和 `devEngines` 固定 |
| 跨端框架 | Taro | `3.6.38` |
| UI 框架 | React | `18.1.0` |
| 类型系统 | TypeScript | `^5.4.5` |
| 状态管理 | Zustand | `^5.0.14` |
| Web 渲染 | React DOM | `18.1.0`，H5 `ImagePreview` 使用 Portal 挂载原生 DOM 灯箱 |
| 移动原生 | React Native | `0.70.15` |
| RN 运行环境 | Expo | `47.0.14` |
| RN SVG | react-native-svg | `13.7.0` |
| 样式预处理 | Sass / SCSS | `^1.77.6` |
| 构建工具 | Webpack | `5.78.0`，由 Taro webpack5 runner 驱动 |
| 编译配置 | Babel | `@babel/core`、`babel-preset-taro` |
| 浏览器自动化 | Playwright Core | `^1.61.1`，H5 smoke 默认驱动系统 Edge |

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

## 运行时与依赖复现

- `.node-version` 固定 Node `24.14.1`；Windows 本地建议使用支持该文件的 fnm 或 mise，CI 应显式读取同一文件。
- `package.json` 的 `packageManager` 固定 npm `11.11.0`，`engines` 声明精确版本，npm 11 `devEngines` 在安装、CI 和运行脚本前按 `onFail: error` 拒绝不一致运行时。
- `scripts/check-runtime.js` 会再次核对 `.node-version`、`package.json`、`package-lock.json` 根元数据和实际 Node/npm，覆盖直接运行聚合脚本的场景。
- 新拉取或验证锁定依赖时使用 `npm.cmd ci`；只有主动增删依赖时才运行 `npm.cmd install` 并提交生成的 `package-lock.json`。
- Node 或 npm 升级属于构建 profile 变更，需要同时更新上述声明，重跑三端构建和 H5 双构建复现门禁，并重新确认压缩尺寸 baseline，不能只改其中一个版本入口。

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
| JavaScript (`.js`) | Taro、Babel、Metro、工程检查、smoke 与 RN 入口脚本 | 只用于工具链和运行脚本，不承载页面业务组件 |

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

启动和进入评定页时，前端会通过 `src/utils/runtimeEnvironment.ts` 归一化 API、WebSocket 和离线模式状态，并在登录页和评定状态栏展示当前运行环境。

## 运行命令

在 Windows PowerShell 下运行 npm 命令必须使用 `npm.cmd`。

| 场景 | 命令 |
| --- | --- |
| 按锁文件安装依赖 | `npm.cmd ci` |
| 主动变更依赖 | `npm.cmd install` |
| 运行时版本检查 | `npm.cmd run check:runtime` |
| H5 开发 | `npm.cmd run dev:h5` |
| 微信小程序开发 | `npm.cmd run dev:weapp` |
| React Native Metro | `npm.cmd run dev:rn` |
| Taro RN 开发入口 | `npm.cmd run dev:rn:taro` |
| H5 构建 | `npm.cmd run build:h5` |
| H5 图片预览产物校验 | `npm.cmd run validate:h5-preview-bundle` |
| 微信小程序构建 | `npm.cmd run build:weapp` |
| Android RN Bundle | `npm.cmd run build:rn` |
| Taro RN 构建入口 | `npm.cmd run build:rn:taro` |
| 核心检查聚合 | `npm.cmd run check:core` |
| 类型检查 | `npm.cmd run typecheck` |
| H5 体积分析 | `npm.cmd run analyze:h5-size` |
| H5 体积 JSON 报告 | `npm.cmd run analyze:h5-size:json` |
| H5 复现报告比较 | `npm.cmd run compare:h5-reproducibility -- <第一次报告.json> <第二次报告.json>` |
| H5 体积基线比较 | `npm.cmd run compare:h5-size` |
| 显式更新 H5 体积基线 | `npm.cmd run update:h5-size-baseline` |
| RN 样式静态校验 | `npm.cmd run validate:rn-styles` |
| RN 公共源码语法校验 | `npm.cmd run validate:rn-source` |
| 登录角色权限测试 | `npm.cmd run test:auth-permissions` |
| 监控埋点工具测试 | `npm.cmd run test:monitoring` |
| 监控上报服务测试 | `npm.cmd run test:monitoring-service` |
| H5 图片预览 bundle 规则测试 | `npm.cmd run test:h5-preview-bundle` |
| H5 固定构建环境清洗测试 | `npm.cmd run test:h5-size-build-env` |
| H5 复现报告比较规则测试 | `npm.cmd run test:h5-reproducibility` |
| 运行时版本策略测试 | `npm.cmd run test:runtime` |
| 文档索引页面矩阵校验 | `npm.cmd run validate:docs-index` |
| 评分配置校验 | `npm.cmd run validate:evaluation` |
| 图文快照路由校验 | `npm.cmd run validate:note-snapshot-routes` |
| 评分计分测试 | `npm.cmd run test:evaluation` |
| 评定草稿归一化测试 | `npm.cmd run test:evaluation-draft` |
| 提交前校验测试 | `npm.cmd run test:evaluation-validation` |
| 评定草稿同步状态测试 | `npm.cmd run test:evaluation-sync-status` |
| 评定状态栏展示测试 | `npm.cmd run test:evaluation-status-display` |
| 图片库归一化测试 | `npm.cmd run test:image-library-normalization` |
| 图文材料归一化测试 | `npm.cmd run test:note-normalization` |
| 图文材料资产元数据测试 | `npm.cmd run test:note-asset-metadata` |
| 图文材料离线保存测试 | `npm.cmd run test:note-store` |
| 图文快照展示测试 | `npm.cmd run test:note-snapshot` |
| 图文快照服务测试 | `npm.cmd run test:note-snapshot-service` |
| 页面矩阵测试 | `npm.cmd run test:page-matrix` |
| 提交记录接口归一化测试 | `npm.cmd run test:submission-normalization` |
| 提交详情服务测试 | `npm.cmd run test:submission-service` |
| WebSocket 流转 ACK 测试 | `npm.cmd run test:transfer-delivery` |
| 图片上传逐张队列测试 | `npm.cmd run test:upload-queue` |
| 上传响应归一化测试 | `npm.cmd run test:upload-normalization` |
| Smoke 记录模板测试 | `npm.cmd run test:smoke-records` |
| H5 smoke runner 测试 | `npm.cmd run test:h5-smoke-runner` |
| H5 smoke 记录模板 | `npm.cmd run smoke:h5:record` |
| H5 smoke runner | `npm.cmd run smoke:h5:run -- --base-url http://127.0.0.1:10086 --out output/smoke/h5-results.json` |
| H5 smoke 结果 JSON 模板 | `npm.cmd run smoke:h5:results` |
| H5 smoke 校验并生成记录 | `npm.cmd run smoke:h5:finalize -- --results output/smoke/h5-results.json --out output/smoke/h5-smoke.md` |
| RN smoke 记录模板 | `npm.cmd run smoke:rn:record` |
| RN smoke 结果 JSON 模板 | `npm.cmd run smoke:rn:results` |
| RN smoke 校验并生成记录 | `npm.cmd run smoke:rn:finalize -- --results output/smoke/rn-results.json --out output/smoke/rn-smoke.md` |
| Smoke 结果 JSON 校验 | `npm.cmd run validate:smoke-results -- --target h5 --results output/smoke/h5-results.json` |

当前 README 记录了 Node 24 下 Taro 3.6 RN runner 直接 `spawn('npx.cmd')` 可能失败的问题。RN 相关开发应优先参考 README 中对 `dev:rn`、`build:rn`、`dev:rn:taro` 和 `build:rn:taro` 的说明。

生产产物按目标隔离：H5 输出到 `dist/h5`，微信小程序输出到 `dist/weapp`，RN Android Bundle 输出到 `dist/rn/android`，避免后执行的 Taro 构建清空其他端产物。`dev:rn` 使用 React Native CLI 启动 Metro；`build:rn` 会先运行 `scripts/ensure-rn-output.js`。`dev:rn:taro` 和 `build:rn:taro` 保留为 Node 18/20 环境下的原始 Taro RN 入口，并输出到 `dist/rn/taro`。

Taro CLI 在本机可能输出 `C:\Users\<用户>\.taro-global-config\index.json` 不存在的提示，这是用户级全局配置缺省信息；当前项目不依赖该文件。构建是否成功以命令退出码、`check:core`、`check:builds`、体积对比和目标校验脚本为准，不应把该提示单独当作失败项。

## 构建配置

主要构建配置位于 `config` 目录：

- `config/index.ts`：基础 Taro 配置，包含项目名、设计稿宽度、源码目录、输出目录、React 框架、webpack5 编译器、H5、小程序和 RN 配置。
- `config/dev.ts`：开发环境配置，H5 devServer 默认端口为 `10086`。
- `config/prod.ts`：生产环境配置，当前主要设置 H5 publicPath。

RN 相关入口：

- `index.js`：React Native 入口。
- `metro.config.js`：Metro 配置。
- `scripts/ensure-rn-output.js`：RN bundle 输出目录检查脚本。
- `scripts/check-runtime.js`：无第三方依赖的运行时校验脚本，核对 `.node-version`、`package.json` 的 `engines` / `packageManager` / `devEngines`、`package-lock.json` 根 `engines` 与实际 Node/npm；版本或声明漂移时返回非零。
- `scripts/test-runtime-check.js`：运行时策略 fixture 测试，覆盖声明一致、拒绝只警告的 `onFail`、lock 根元数据漂移以及实际 Node/npm 不匹配。
- `scripts/test-monitoring.js`：监控埋点工具测试，覆盖事件计数、接口失败聚合、事件上限裁剪、批量上报 payload、已上传事件清理，以及用户标识、正文、图片 URL、长字符串等敏感上下文的默认脱敏。
- `scripts/test-monitoring-service.js`：监控上报服务测试，覆盖空队列跳过、未配置 API 跳过、按批次 POST `/frontend-monitoring-events`、按后端确认 ID 清理、上报失败保留事件并记录错误。
- `scripts/check-core.js`：核心检查聚合脚本，按顺序执行运行时校验及其 fixture、文档索引页面矩阵校验、评分配置校验、计分测试、草稿归一化、提交前校验、监控埋点工具与上报服务测试、H5 图片预览 bundle 和构建复现报告规则测试、图文/图片/提交/上传归一化测试、图文快照展示与服务测试、页面矩阵测试、H5 smoke runner 测试、图文快照路由校验和 TypeScript 类型检查。
- `scripts/utils/load-ts-module.js`：脚本测试共用的 TypeScript 模块加载器，统一处理 TS 转译、相对模块解析和模块缓存。
- `scripts/utils/page-matrix.js`：页面矩阵工具，统一维护注册页面名称、页面类型（`shell`、`detail`、`status`）和 smoke 覆盖标记，并提供页面列表、文档入口和 H5 详情白名单解析函数。
- `scripts/validate-docs-index.js`：文档索引页面矩阵校验脚本，读取 `src/app.config.ts` 的页面列表，检查 `docs/00-index.md` 当前页面入口、`docs/01-framework-architecture.md` 页面结构、H5/RN smoke 清单和 H5 详情路由白名单是否同步，并确认每个注册页面具备 TSX、H5 SCSS 和 RN SCSS 文件。
- `scripts/validate-evaluation-config.js`：评分配置结构校验脚本，覆盖规则版本、维度总分、分区上限、条目上限和选项分值。
- `scripts/test-auth-permissions.js`：登录角色权限测试脚本，覆盖角色归一化、离线演示用户 ID 角色推断和后台模式权限矩阵。
- `scripts/validate-note-snapshot-routes.js`：图文快照路由校验脚本，覆盖页面注册、H5 详情路由白名单、`snapshotKey` 读取、最近快照兜底和 H5/RN smoke 清单关键词。
- `scripts/test-evaluation-scoring.js`：评分计分测试脚本，覆盖固定分、选项分、次数分、数值分、条目封顶和维度封顶。
- `scripts/test-evaluation-draft.js`：评定草稿归一化测试脚本，覆盖旧草稿补齐、默认已选条目、有材料条目自动选中和冲突判断。
- `scripts/test-evaluation-validation.js`：提交前校验测试脚本，覆盖已选无记录、已选无材料、缺文字、无效数值和本地图片未上传。
- `scripts/test-evaluation-sync-status.js`：评定草稿同步状态测试脚本，覆盖编辑后本地未保存、未登录本地保存、远端同步成功、远端同步失败状态，以及远端失败错误码和 HTTP 状态码保留。
- `scripts/test-evaluation-status-display.js`：评定状态栏展示测试脚本，覆盖同步状态文案、最近保存时间格式化、状态组合展示、稳定错误码/HTTP 状态码分类优先级和错误文案兜底。
- `scripts/test-image-library-normalization.js`：图片库归一化测试脚本，覆盖图片字段兼容、缺 URL 过滤、本地旧缓存兜底、使用元信息合并和 `ProofImage` 转换。
- `scripts/test-note-normalization.js`：图文材料归一化测试脚本，覆盖内容块摘要提取、图片数量统计、标签和维度约束、来源与使用统计、蛇形/驼峰字段兼容、元数据合并和搜索过滤。
- `scripts/test-note-asset-metadata.js`：图文材料资产元数据测试脚本，使用 mock Storage 覆盖旧缓存补齐、标签/来源保留、引用次数、最近使用时间和关联评定上下文写入。
- `scripts/test-note-store.js`：图文材料离线保存测试脚本，使用 mock Storage 覆盖未配置 API 时不发起 `/notes` 请求、标题/内容/标签/关联维度/来源写入本地索引和草稿，并恢复干净保存状态。
- `scripts/test-note-snapshot.js`：图文快照展示测试脚本，覆盖快照摘要去空白、长度截断、空摘要兜底、标题、图片数量、引用时间、内容块快照优先、旧数据摘要兜底、快照路由和本地快照索引合并裁剪。
- `scripts/test-note-snapshot-service.js`：图文快照服务测试脚本，使用 mock Taro Storage 覆盖快照预览写入、最近快照兜底、索引上限裁剪、旧 key 清理和重复快照覆盖。
- `scripts/test-submission-service.js`：提交详情服务测试脚本，使用 mock Taro Storage 和 mock API 覆盖服务端详情读取、详情缓存和本地兜底。
- `scripts/test-submission-normalization.js`：提交记录接口归一化测试脚本，覆盖蛇形/驼峰字段兼容、时间解析、空提交 ID 过滤和本地旧缓存兜底。
- `scripts/test-upload-normalization.js`：上传响应归一化测试脚本，覆盖图片预检、上传响应字段兼容、缺原图 URL 抛错、本地图片和已上传图片的 `ProofImage` 转换。
- `scripts/create-h5-smoke-record.js`：H5 smoke 人工验收记录模板生成脚本，默认输出到终端，传 `--out` 时写入指定文件；步骤结果表会带页面类型列，传 `--results` 时可按自动化结果 JSON 回填结果、备注、截图、日志和 Runner 元信息摘要。
- `scripts/create-rn-smoke-record.js`：RN Android smoke 人工验收记录模板生成脚本，默认输出到终端，传 `--out` 时写入指定文件；步骤结果表会带页面类型列，传 `--results` 时可按自动化结果 JSON 回填结果、备注、截图、日志和 Runner 元信息摘要。
- `scripts/create-smoke-results-template.js`：Smoke 结果 JSON 模板生成脚本，通过 `--target h5|rn` 读取对应 checklist，输出可被记录生成器 `--results` 消费的完整步骤 JSON。
- `scripts/run-h5-smoke.js`：H5 smoke runner，先检查入口与静态覆盖，再通过 `playwright-core` 启动系统 Edge 执行登录、填报、草稿恢复、图片选择、图片库直达与轻量预览、图文编辑/引用、预览定位、离线提交拦截、fixture 结果/历史和移动端溢出检查。默认把逐步截图、trace、diagnostics、入口响应、静态检查和元信息写入 `output/playwright/h5-smoke-runner/<timestamp>/`；支持 `--browser`、`--headed`、`--timeout-ms`、`--artifact-dir` 和仅做预检的 `--static-only`。
- `scripts/utils/h5-smoke-browser-flow.js`：H5 真实浏览器交互流程；图片库步骤写入两张 data URL fixture，扫描首次直达所加载的 JS 是否包含 Swiper 标记，并断言预览打开、下一张、计数、Escape 关闭和触发器焦点恢复。控制台和页面异常在产生时记录当前 `flow` 与页面 URL，并只回写到对应 smoke 步骤。
- `scripts/validate-smoke-results.js`：Smoke 结果 JSON 校验脚本，检查步骤数量、顺序、`flow`、`type`、`result` 枚举；“通过/失败”必须有备注且至少有截图或日志，“跳过”必须说明原因，所有证据必须是项目内真实存在的文件。
- `scripts/finalize-smoke-record.js`：Smoke 记录归档脚本，通过 `--target h5|rn` 先校验结果 JSON，再调用对应记录生成器输出 Markdown 报告。
- `scripts/test-smoke-record-generators.js`：Smoke 记录模板生成测试脚本，覆盖 H5/RN 模板关键字段、checklist 步骤、页面类型、视觉检查、证据项、`PAGE_MATRIX` 中标记为 smoke 覆盖的页面入口、结果 JSON 模板、结果 JSON 校验、`--results` 自动化结果回填和 finalize 归档。
- `scripts/validate-h5-preview-bundle.js`：扫描 `dist/h5/js` 全部产物，禁止 `taro-swiper-core`、`defineCustomElementTaroSwiper`、`swiper-container-` 和 `data-swiper-slide-index` 四个 Swiper 标记；同时要求存在 `image-preview__dialog` 轻量预览标记，并从运行时路由映射解析图片库 chunk，严格要求其 raw 小于 `249856` B。
- `scripts/test-h5-preview-bundle.js`：使用隔离 fixture 覆盖合法产物、缺失 JS 目录、禁用标记、缺少轻量预览、缺失或重复路由 chunk，以及 raw 恰好达到上限时必须失败等规则。
- `scripts/utils/h5-size-build-env.js` 与 `scripts/test-h5-size-build-env.js`：集中生成 production、无 API、无 sourcemap 的 H5 固定环境，并按大小写不敏感规则清除父进程中的 `H5_SIZE_*`、`H5_ANALYZE_SOURCEMAP`、`H5_PREVIEW_BUNDLE_DIST_ROOT`、`NODE_ENV` 与 API/WS 地址；fixture 覆盖 PowerShell 小写和混合大小写键，防止 Windows 子进程把分析、baseline 或预览 bundle 门禁重定向到其他目录。
- `scripts/analyze-h5-size.js`：生成 schema v1 H5 体积报告，按单资源分别计算 raw、gzip level 9 和 Brotli quality 11/generic 后求和；报告记录构建目标、模式、环境 profile、sourcemap 状态、Node/zlib/Brotli 运行时、入口/JS/CSS 汇总、资源三尺寸和 `logicalKey`。路由 chunk 从运行时映射生成 `route/pages/...` 语义键，普通 content hash 会从逻辑键移除；`H5_ANALYZE_SOURCEMAP=1` 只用于本地模块归因，`H5_SIZE_STRICT=1` 可检查单资源 raw 绝对阈值。
- `scripts/compare-h5-size.js`：默认比较 `scripts/baselines/h5-size.json` 与 `dist/h5-size-report.json`，先严格校验 schema、构建 profile、压缩参数、三尺寸字段、汇总一致性和 `logicalKey` 唯一性，再比较入口、汇总和资源。`--strict` 或 `H5_SIZE_COMPARE_STRICT=1` 会按 raw 20 KiB、gzip 6 KiB、Brotli 5 KiB 默认增长阈值返回非零；sourcemap 来源分组只作诊断。
- `scripts/utils/h5-reproducibility.js` 与 `scripts/compare-h5-reproducibility.js`：比较连续两份 H5 schema v1 报告，只忽略必然变化的根 `generatedAt`，其余 path、logicalKey、build/compression 元数据、raw/gzip/Brotli、入口和资源明细都必须深度一致；同时要求图片库两个手写 lazy chunk 具有稳定 JS logicalKey，上传组件还必须具有稳定 CSS logicalKey。
- `scripts/test-h5-reproducibility.js`：H5 复现 comparator fixture 测试，覆盖时间戳差异可通过，以及 path、logicalKey、raw、gzip、Brotli、缺少稳定 lazy key、重复 key 任一漂移必须失败。
- `scripts/update-h5-size-baseline.js`：先校验固定 Node/npm，再清理 H5 体积相关继承环境变量，固定 production、无 API、无 sourcemap profile，重新构建 H5 并显式更新受版本控制的 baseline。普通 `analyze:h5-size` 和 `analyze:h5-size:json` 不会覆盖它。
- `scripts/check-builds.js`：先校验运行时，再以 baseline 的固定 profile 连续执行两次干净 H5 构建；第一次报告保存在系统临时目录，第二次产物先通过图片预览 bundle 门禁，再生成保留在 `dist` 的报告，只豁免 `generatedAt` 后执行复现性对比、稳定 lazy logicalKey 断言和严格体积 baseline 比较；随后构建微信小程序和 RN Android Bundle，并在 `finally` 清理临时报表。

## 服务模块

服务层当前拆分为：

| 文件 | 能力 |
| --- | --- |
| `src/services/api.ts` | REST 请求封装、API/WS 环境变量、Bearer token、错误信息归一化 |
| `src/services/authService.ts` | 登录和离线登录模式判断 |
| `src/services/evaluationService.ts` | 评定快照、远端草稿和正式提交 |
| `src/services/noteService.ts` | 图文材料列表、详情、本地索引缓存和搜索 |
| `src/services/noteSnapshotService.ts` | 图文引用快照预览写入、最近快照兜底、索引维护和旧快照清理 |
| `src/services/imageLibraryService.ts` | 图片列表、本地图片缓存和远端失败兜底 |
| `src/services/submissionService.ts` | 提交摘要保存、提交历史和本地结果读取 |
| `src/services/upload.ts` | 图片选择、上传、上传进度回调、取消句柄和证明图片转换 |
| `src/services/websocket.ts` | WebSocket 连接、认证、入房、心跳、重连和事件分发 |
| `src/services/transferService.ts` | 跨设备流转发送、接收应用和应用前确认 |

## 依赖维护原则

- 新增依赖前先确认是否可由 Taro、React、Zustand 或项目已有工具实现。
- Taro 相关包应保持同一主版本和补丁版本，避免跨版本混装。
- React、React DOM、React Native 版本变更会影响多端运行，必须单独验证 H5、小程序和 RN。
- `package.json` 中 `overrides` 固定了 RN 相关依赖版本，调整前必须确认 Taro RN runner 和 Metro 兼容性。
- 日常安装使用 `npm.cmd ci`，不得让验证流程改写 lock；`package-lock.json` 只在主动依赖或 package 根元数据变更时由固定 npm 版本运行 `npm.cmd install` 生成，不手写。
