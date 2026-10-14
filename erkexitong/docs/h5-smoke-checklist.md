# H5 Smoke Checklist

## 目标

用于 H5 构建通过后的人工 smoke 验收，覆盖学生从登录、评定填报、草稿保存、提交前预览、问题定位到提交反馈的核心闭环。

## 前置条件

- 已执行 `npm.cmd run build:h5`，并确认 `dist/h5` 中 H5 产物已生成。
- 已执行 `npm.cmd run validate:h5-preview-bundle`，确认全量 H5 JS 无禁用的 Swiper 标记，且图片库路由 JS raw 小于 `249856` B。
- 浏览器可访问 H5 页面，建议同时准备桌面宽屏和移动端模拟视口。
- 自动化 runner 默认通过 `playwright-core` 启动系统 Edge；依赖安装完成且本机 Edge 可启动。
- 可使用离线演示模式；若配置了后端接口，也需要记录 API 与 WebSocket 状态。
- 准备至少 2 张 JPG/PNG/WebP 测试图片，其中 1 张可用于模拟上传失败或提交前本地图片失败定位。

## 验收流程

| 步骤 | 页面或流程 | 操作 | 通过标准 |
| --- | --- | --- | --- |
| 1 | 登录页 | 打开 H5，输入测试学号并登录。 | 登录页无白屏、无明显布局重叠；API、WebSocket 和离线模式状态文案可读；能进入评定页。 |
| 2 | 评定页首页 | 查看顶部状态栏、评分概览、维度入口、审核/填报切换和底部操作。 | 五维评分、材料数量、草稿同步状态和主要操作不遮挡；桌面双栏和移动单栏布局均可滚动。 |
| 3 | 评定页填报 | 选择一个维度条目，填写文字、选择选项或数值，添加一条证明记录。 | 输入、选择、数值和添加记录可操作；分数与材料数量更新；本地未保存/已保存状态变化可见。 |
| 4 | 保存草稿 | 修改评定内容后触发保存，刷新页面或重新进入评定页。 | 草稿内容可恢复；离线时明确提示只能本地暂存；在线失败时显示同步失败原因且不误导为正式提交。 |
| 5 | 图片上传区域 | 在证明记录中选择图片、打开图片库、引用图文材料，并测试上传失败或取消后的重试。 | 图片区域不溢出；失败/取消图片可看到原因、缩略图、重试和移除入口；已成功图片不会因后续失败丢失。 |
| 6 | 图片库页 | 首次直达图片库，切换来源、维度、引用状态和排序筛选并重置；用 Enter 打开第一张图片，切换下一张，按 Escape 关闭后用 Space 再次打开。 | 首次加载的 JS 不含禁用的 Swiper 标记；筛选恢复默认条件；预览入口是带可访问名称的原生按钮；轻量预览显示正确计数和图片，下一张可切换，Escape 可关闭且焦点回到打开预览的图片，Space 可再次打开。 |
| 7 | 图文材料列表页 | 从评定记录的图文入口打开图文材料列表页，搜索或选择已有材料。 | 列表、搜索、空态和错误兜底可读；选择材料后能返回评定条目引用。 |
| 8 | 图文编辑页 | 新建或继续编辑一条含文字和图片的图文材料，保存后返回引用。 | 标题、文字块、图片块、预览和保存可操作；保存失败不丢失当前编辑内容。 |
| 9 | 图文快照页 | 从引用卡片或提交结果打开图文快照页。 | 图文快照页可只读展示内容块，点击快照图片可预览，图片加载失败时有固定占位；原材料不可用时保留快照并给出提示。 |
| 10 | 图文材料引用 | 回到评定条目查看已引用的图文材料。 | 引用卡片展示标题、摘要和图片数量；可查看原材料，也可打开快照。 |
| 11 | 提交前预览页 | 从评定页进入提交前预览页，查看分数、材料明细和待完善问题。 | 预览摘要与当前草稿一致；待完善问题可读；点击问题能返回对应维度、条目或证明记录。 |
| 12 | 定位校验问题 | 故意保留缺文字、无效数值或本地图片未上传问题，从预览页点击定位。 | 返回评定页后自动切到填报模式，展开对应维度并高亮问题位置；图片问题应高亮上传区域或具体图片。 |
| 13 | 提交失败提示 | 在离线或接口失败条件下尝试正式提交；若可模拟本地图片上传失败，点击“定位修改”。 | 离线不会进入提交结果页；失败弹窗说明清晰，草稿保留；本地图片失败能展示维度、条目和第几张图片，并可定位修改。 |
| 14 | 提交结果页 | 在具备可提交条件和接口可用时正式提交。 | 成功后进入提交结果页，展示提交时间、规则版本、五维得分、材料数量和提交时材料快照。 |
| 15 | 提交历史页 | 打开提交历史页，查看审核状态、退回原因和补充入口。 | 状态标签、审核意见、退回原因和“去补充”入口可读可点；退回提醒不会遮挡主流程。 |
| 16 | 状态说明页 | 通过无效入口、离线不可用或同步异常场景进入状态说明页。 | 页面能说明当前状态和下一步操作，返回入口可用，文案不会让用户误以为已正式提交。 |

## 视觉检查

- 桌面双栏布局不应出现横向溢出，评定详情、图片库和预览页内容应能完整滚动。
- 移动端模拟视口下，按钮文字、标签、进度条和缩略图不应互相遮挡。
- 上传队列、失败图片定位、高亮态和弹窗操作应保持稳定尺寸，不能导致页面明显跳动。
- 图片预览在桌面和移动视口均应覆盖页面且不引起底层滚动；预览入口应支持 Enter/Space；关闭、前后切换和重试控件应保持可见焦点，关闭后焦点返回触发图片。
- 图文快照页的图片预览入口和加载失败占位不应撑破内容面板，也不应遮挡返回按钮。
- H5 构建若出现已知体积告警，需要记录资源名与大小；新增告警应补充到后续优化方向。

## 记录格式

可先生成记录模板，再按实际结果补全；模板的步骤结果表会包含 `shell`、`detail`、`status`、`flow` 类型列，便于后续自动化 smoke 按页面类型回填截图和日志：

```bash
npm.cmd run smoke:h5:record -- --out output/smoke/h5-smoke-2026-07-11.md
```

自动化 smoke 可以先输出结果 JSON，再生成已回填的记录：

```bash
npm.cmd run smoke:h5:results -- --out output/smoke/h5-results.json
npm.cmd run smoke:h5:finalize -- --results output/smoke/h5-results.json --out output/smoke/h5-smoke-2026-07-11.md
```

H5 runner 会先检查 `--base-url` 是否返回 2xx/3xx 且包含应用壳，再执行源码静态覆盖预检，随后启动真实 Edge 完成登录、填报、本地草稿恢复、图片选择/预览/删除、图片库首次直达 JS 扫描、筛选、Enter 打开预览、双图预览、计数切换、Escape 关闭与焦点恢复、Space 再次打开、图文编辑/保存/刷新/预览、图文快照与引用、预览问题定位、离线提交拦截、fixture 结果/历史、状态页和 390×844 横向溢出检查。静态预检只决定是否具备继续运行的条件，不能替代浏览器交互：

```bash
npm.cmd run smoke:h5:run -- --base-url http://localhost:10086 --out output/smoke/h5-results.json
npm.cmd run smoke:h5:finalize -- --results output/smoke/h5-results.json --out output/smoke/h5-smoke-2026-07-11.md
```

runner 默认使用 `--browser msedge`，可传 `--headed` 显示浏览器、`--timeout-ms` 调整入口与页面操作超时、`--artifact-dir` 指定证据目录。`--static-only` 只执行入口和源码预检，此模式下所有流程必须标记“跳过”，不能产生“通过”。

多浏览器回归应使用矩阵 runner 包装同一套 H5 checklist。矩阵 runner 会为每个浏览器通道分别调用 `smoke:h5:run`，写入独立 results 与 artifact 目录，并立即执行 `validate:smoke-results`；任一通道 smoke 失败或结果证据不合规，矩阵命令都会返回非零。`--static-only` 可用于验证矩阵编排和严格证据门禁，但不能替代真实浏览器通过记录：

```bash
npm.cmd run smoke:h5:matrix -- --base-url http://localhost:10086 --browsers msedge,chromium --out-dir output/smoke/h5-matrix --artifact-root output/playwright/h5-smoke-matrix
```

runner 默认在 `output/playwright/h5-smoke-runner/<timestamp>/` 写入逐步截图、`h5-browser-trace.zip`、`h5-browser-diagnostics.json`、`h5-entry-response.txt`、`h5-static-checks.json` 和 `h5-run-metadata.json`。diagnostics 会给 console/page error 记录实际 `flow` 和页面 URL；未过滤的运行时异常、fatal flow、步骤失败或移动端横向溢出都会让进程返回非零退出码。

结果校验采用严格证据门禁：“通过/失败”必须有非空备注且至少关联截图或日志，“跳过”必须说明原因；所有证据路径必须位于项目内、真实存在且为文件。正式归档前必须通过：

```bash
npm.cmd run validate:smoke-results -- --target h5 --results output/smoke/h5-results.json
```

2026-07-14 的正式结果为 15 项通过、0 项失败、1 项跳过；跳过项是未配置真实后端时的正式提交，fixture 结果页仍已验证。结果、报告和证据分别位于 `output/smoke/h5-browser-results-2026-07-14.json`、`output/smoke/h5-browser-smoke-2026-07-14.md` 和 `output/playwright/h5-smoke-runner-2026-07-14/`。

上述归档早于 H5 图片预览拆包与键盘触发断言；Enter/Space 打开、切换、Escape、焦点恢复和首次直达无 Swiper 的结论，应以拆包后的下一次真实浏览器结果与证据为准，不能由 runner 源码或静态 bundle 校验代替。

结果 JSON 最小格式如下，通常由 `smoke:h5:results` 先生成完整步骤后再由人工或自动化脚本填入结果：

`smoke:h5:finalize` 会先执行 `validate:smoke-results`，校验步骤数量、顺序、`flow` 和 checklist 一致，`type` 与页面矩阵一致，`result` 只能为 `未执行`、`通过`、`失败` 或 `跳过`，截图和日志使用项目内相对路径，再生成记录；若 results JSON 包含 `meta`，记录中会生成“Runner 元信息”摘要。

```json
{
  "steps": [
    {
      "flow": "登录页",
      "result": "通过",
      "note": "登录入口正常",
      "screenshot": "output/smoke/login.png",
      "log": "output/smoke/login.log"
    }
  ]
}
```

```text
日期：
浏览器/视口：
构建命令：npm.cmd run build:h5
API 状态：
WebSocket 状态：
离线模式：
通过步骤：
失败步骤：
截图或日志：
已知 H5 体积告警：
后续处理：
```
