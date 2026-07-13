# 版本迭代优化方向

本文档用于记录二课系统前端当前完成状态、后续版本方向和仍需后端/API 配合的事项。历史逐日处理记录已合并为按能力分类的完成情况，避免路线图变成流水账。

## 当前完成状态

截至 2026-07-13，前端已从可演示版本推进到具备稳定填报闭环、材料复用、提交快照、基础审核视图、多端构建检查和 smoke 记录体系的阶段。

| 能力域 | 已完成内容 | 主要入口或脚本 |
| --- | --- | --- |
| 填报闭环 | 登录、评定填报、本地草稿、远端草稿同步、提交前预览、正式提交、提交结果和提交历史已形成闭环；离线模式不会伪造正式提交。 | `pages/evaluation/index`、`pages/evaluation/preview/index`、`pages/submission/result/index`、`pages/submission/history/index` |
| 问题定位 | 提交前校验问题可从预览页返回评定页，自动切换填报模式、展开维度、滚动到条目并聚焦字段；本地图片问题会高亮上传区域并标记图片序号。 | `src/utils/evaluationValidation.ts`、`src/utils/evaluationIssueFocus.ts` |
| 提交快照 | 提交摘要保存五维得分、材料数量、提交时间、规则版本、校验问题快照和提交时材料快照；提交后回看不依赖当前草稿。 | `src/services/submissionService.ts`、`src/utils/submissionNormalization.ts` |
| 图文快照 | 图文引用会写入独立快照 key，快照页优先按 `snapshotKey` 读取，并保留旧最近快照 key 兼容兜底；图片预览和失败占位已接入。 | `pages/note/snapshot/index`、`src/services/noteSnapshotService.ts` |
| 材料复用 | 评定条目可复用图片库图片；图片库记录引用次数、最近使用时间和关联维度/分区/条目；图文与图片响应均有归一化工具。 | `pages/image/library/index`、`src/utils/imageLibraryNormalization.ts`、`src/utils/noteNormalization.ts` |
| 图片上传 | 图片选择支持格式/大小预检；多图上传按单张成功结果落库；失败或取消后保留成功项，失败项支持单张重传；提交前本地证明图片批量上传显示进度。 | `src/components/UploadImageButton`、`src/services/upload.ts`、`src/utils/uploadNormalization.ts` |
| 反馈文案 | 本地暂存、远端未同步、离线不可正式提交、正式提交失败、图片选择/上传失败和补传后立即提交提示已统一到可复用文案工具。 | `src/utils/feedbackMessages.ts` |
| 审核视图 | 评定页后台模式已展示审核记录、问题队列、五维分布、提交历史入口和基础排序；学生提交历史展示审核状态、审核意见、退回原因和补充入口。 | `src/pages/evaluation/components/EvaluationAdminDashboard.tsx`、`src/utils/reviewStatus.ts` |
| 评分规则 | 评分规则集中配置，带版本号 `2026.07.v1`；已覆盖配置结构校验、计分测试、草稿归一化和提交前校验测试。 | `src/data/evaluationConfig.ts`、`npm.cmd run validate:evaluation`、`npm.cmd run test:evaluation` |
| 页面矩阵 | 注册页面、页面类型、H5 详情白名单、文档入口和 smoke 覆盖统一校验；新增页面需要同时补齐 TSX、H5 SCSS、RN SCSS 和文档入口。 | `scripts/utils/page-matrix.js`、`npm.cmd run test:page-matrix`、`npm.cmd run validate:docs-index` |
| H5 smoke | H5 checklist、结果 JSON 模板、记录生成、结果校验、finalize 归档和无依赖入口 runner 已完成；runner 会输出入口响应日志和元信息。 | `docs/h5-smoke-checklist.md`、`npm.cmd run smoke:h5:run`、`npm.cmd run smoke:h5:finalize` |
| RN smoke | RN checklist、结果 JSON 模板、记录生成、结果校验和 finalize 归档已完成；RN 样式已补齐到 Bundle 可通过的最低跨端覆盖。 | `docs/rn-smoke-checklist.md`、`npm.cmd run smoke:rn:record`、`npm.cmd run smoke:rn:finalize` |
| 工程检查 | `check:core` 已聚合文档矩阵、评分配置、核心工具测试、页面矩阵、smoke 记录、H5 runner、图文快照路由和 TypeScript 检查。 | `npm.cmd run check:core` |
| H5 体积 | H5 资源体积分析、JSON 报告、历史对比、阈值识别和严格模式测试已接入。 | `npm.cmd run analyze:h5-size`、`npm.cmd run compare:h5-size` |

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
| P0 | smoke 验收 | 基于 `docs/h5-smoke-checklist.md` 和 `docs/rn-smoke-checklist.md` 补齐一次真实人工验收记录，并归档截图或日志路径。 | 记录可通过 `smoke:*:finalize` 生成，失败项有明确备注和证据路径。 |
| P0 | H5 自动化 | 在项目级 Playwright 或可用 CLI 桥接稳定后，将 H5 runner 从入口探测扩展到登录、评定填报、预览定位和离线提交拦截。 | 自动化结果 JSON 能覆盖核心 H5 步骤，`smoke:h5:finalize` 可生成含截图/日志的记录。 |
| P0 | 后端提交详情 | 对齐提交详情接口，返回完整 `records`、`selectedItemIds`、维度汇总、校验问题、审核状态和规则版本。 | 提交结果和历史详情可从服务端恢复不可变快照，不依赖本地缓存。 |
| P0 | 权限入口 | 接入登录态和角色权限，区分学生、班委、辅导员或管理员可见页面与操作。 | 无权限用户无法进入后台模式或执行审核操作。 |
| P1 | 同步状态 | 将草稿同步状态细化为本地未保存、本地已保存、远端同步中、远端已同步和同步失败。 | 用户能明确判断当前内容保存位置和失败原因。 |
| P1 | WebSocket ACK | 流转消息增加消息 ID、投递确认、失败重试和服务端时间。 | 发送失败不会被误判为已送达，历史记录可追踪状态。 |
| P1 | 草稿冲突 | 优化本机与远端草稿冲突比较，展示关键差异、保存时间和设备来源。 | 用户选择保留版本前能看懂差异，不会静默覆盖。 |
| P1 | 图片体验 | 为失败图片展示短文件名、缩略图、独立失败原因和更完整的逐张状态列表。 | 多图上传中成功、失败、取消和重试状态清晰可见。 |
| P1 | 材料资产 | 为图文和图片增加标签、关联维度、来源、最近使用时间和后端稳定 ID。 | 评定条目可稳定引用材料来源，删除原材料不破坏提交快照。 |
| P1 | RN 验收 | 在真机或模拟器环境补齐 RN 首页、评定填报、图片库、预览、提交结果和提交历史 smoke。 | RN Bundle 不只验证产物存在，还验证核心页面可读可操作。 |
| P2 | 审核统计 | 增加班级提交率、待审核数量、退回数量、平均分、维度缺口和材料完成度视图。 | 学生和审核人员能快速识别风险维度和待处理记录。 |
| P2 | 数据导出 | 支持 CSV 或 Excel 导出，并和页面统计口径保持一致。 | 导出字段、筛选条件和页面展示一致，大数据量不阻塞主页面。 |
| P2 | 监控埋点 | 接入错误日志、接口失败统计和关键操作埋点。 | 线上异常可追踪到接口、页面、用户动作和时间。 |

## 后端/API 配合点

| 能力 | 契约方向 |
| --- | --- |
| 正式提交 | 创建提交、提交详情、提交状态、提交时规则版本和完整材料快照。 |
| 审核流转 | 审核列表、审核详情、状态更新、审核意见、退回原因、审核人和审核时间。 |
| 批量审核 | 按班级、状态、提交时间、问题数量、学生关键词分页查询。 |
| 材料复用 | 图文材料、图片、评定记录之间的稳定引用 ID 和快照索引。 |
| 图片上传 | 稳定图片 ID、缩略图、尺寸、大小、可访问 URL 和失败错误码。 |
| 规则版本 | 评分规则版本、启用时间、发布状态、回滚能力和提交记录关联规则版本。 |
| WebSocket | 消息 ID、ACK、失败原因、服务端时间、设备在线状态和重连恢复。 |
| 导出统计 | 统计查询、导出任务创建、导出进度、导出文件下载和权限校验。 |

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
