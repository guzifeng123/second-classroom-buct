# 接口与事件约定

## REST API

| 场景 | 方法与路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| 登录 | `POST /login` | `{ "userId": "student-001" }` | `{ "token": "...", "userId": "student-001", "role": "student" }`，`role` 可缺省 |
| 拉取快照 | `GET /snapshot/{userId}` | JWT Header | `{ "records": {}, "selectedItemIds": [], "savedAt": 1710000000000, "deviceName": "实验室 Web 端", "draftVersion": "v3" }`，`deviceName` 和 `draftVersion` 可缺省，用于草稿冲突来源与版本提示 |
| 保存草稿 | `PUT /evaluation-drafts/{userId}` | `{ "records": {}, "selectedItemIds": [], "savedAt": 1710000000000, "draftVersion": "v3" }`，`draftVersion` 可缺省 | 成功：`{ "records": {}, "selectedItemIds": [], "savedAt": 1710000000500, "draftVersion": "v4" }`；失败建议：`{ "code": "AUTH_EXPIRED", "message": "登录已失效，请重新登录" }` |
| 提交材料 | `POST /evaluation-submissions` | `{ "records": {} }` | `{ "submissionId": "uuid" }` |
| 获取提交记录 | `GET /evaluation-submissions?userId=student-001` | JWT Header | `{ "data": [], "total": 10 }` 或数组，记录项可包含 `records`、`selected_item_ids`、`rule_version`、`review_status`、`review_comment`、`return_reason`、`reviewer_name`、`reviewed_at`、`dimension_summaries`、`validation_issues` |
| 获取提交详情 | `GET /evaluation-submissions/{submissionId}` | JWT Header | 记录详情，建议包含完整 `records`、`selected_item_ids`、`rule_version`、`review_status`、`dimension_summaries`、`validation_issues` 和提交时材料快照 |
| 获取审核统计 | `GET /evaluation-submissions/stats?className=一班` | JWT Header，可追加与列表一致的筛选条件 | 建议返回 `total_count`、`submitted_count`、`pending_count`、`returned_count`、`average_score`、`submission_rate`、`material_completion_rate`、`average_material_count` 和 `dimension_stats`；字段口径应与前端 `src/utils/reviewStats.ts` 保持一致 |
| 导出提交记录 | `GET /evaluation-submissions/export?format=csv` | JWT Header，可追加与列表一致的筛选条件 | CSV 文件；字段应与前端 `buildSubmissionCsv` 保持一致：提交编号、学生、班级、提交时间、规则版本、审核状态、总分、材料数、问题数、五维得分、审核意见、退回原因、审核人、审核时间 |
| 上报前端监控事件 | `POST /frontend-monitoring-events` | `{ "schemaVersion": 1, "generatedAt": 1710000000000, "events": [], "apiFailureStats": {}, "keyActionCounts": {}, "errorCount": 0, "droppedEventCount": 0 }` | 建议返回 `{ "acceptedEventIds": ["key-action-..."] }`；前端会按事件 ID 清理已确认事件 |
| 上传图片 | `POST /upload` | `multipart/form-data file` | 成功：`{ "id": "uuid", "original_url": "...", "thumb_url": "...", "width": 800, "height": 600, "size": 204800 }`；失败建议：`{ "code": "IMAGE_TOO_LARGE", "message": "图片超过 5MB", "retryable": false }` |
| 创建图文材料 | `POST /notes` | `{ "title": "...", "content": [], "tags": ["志愿服务"], "dimension_keys": ["labor"] }` | 完整图文对象，包含稳定 `id`、`plain_text`、标签、关联维度、来源和使用统计 |
| 查询图文材料 | `GET /notes?query=关键词` | JWT Header | `{ "data": [], "total": 10 }` 或数组；`query` 应匹配标题、正文、标签和维度名称 |
| 获取图文材料 | `GET /notes/{id}` | JWT Header | 完整图文对象 |
| 更新图文材料 | `PUT /notes/{id}` | `{ "title": "...", "content": [], "tags": [], "dimension_keys": [] }` | 更新后的完整对象；空数组表示主动清空 |
| 获取图片列表 | `GET /images?offset=0&limit=20` | JWT Header | `{ "data": [], "total": 100 }`，图片项可包含 `used_count`、`recent_used_at` 和最近关联条目 |

所有接口默认携带：

```text
Authorization: Bearer <token>
```

## Frontend Behavior Notes

- 未配置 `TARO_APP_API_BASE_URL` 时，前端进入离线演示模式：可登录、填报和本地暂存，但不能提交。
- 登录响应的 `role` 用于前端入口权限，取值为 `student`、`class_committee`、`counselor`、`admin`；缺省或未知角色按 `student` 处理。离线演示模式会按用户 ID 前缀推断角色，例如 `admin`、`counselor-001`、`teacher-001`、`monitor-001` 可进入审核入口，普通 `student-001` 只能进入填报和展示入口。
- 未配置 `TARO_APP_WS_BASE_URL` 时，流转按钮只记录离线演示历史，不建立真实 WebSocket，也不代表其他设备已收到内容。
- 评定页会同时读取本地草稿和远端快照；两边内容不一致时由用户确认使用本机或远端。远端快照若返回 `draftVersion`、`draft_version` 或 `version`，前端会归一化为 `draftVersion` 并在冲突提示中展示。
- 临时保存先写本地，再尝试同步远端；远端失败不丢弃本地草稿。保存远端草稿时前端会带上当前 `draftVersion`，后端应返回保存后的新版本，用于后续并发冲突判断。同步失败响应推荐返回 `{ "code": "...", "message": "..." }`，前端也兼容 `errorCode` 和 `error_code`；分类优先级为稳定错误码、HTTP 状态码、错误文案兜底。建议错误码先覆盖 `AUTH_EXPIRED`、`UNAUTHORIZED`、`FORBIDDEN`、`PERMISSION_DENIED`、`VALIDATION_ERROR`、`INVALID_DRAFT`、`DRAFT_CONFLICT`、`NETWORK_ERROR`、`TIMEOUT`。
- 图文列表、图片库和提交历史优先读取远端；远端失败时回退本地缓存并展示错误信息。
- 图文保存先写本地图文草稿，再尝试写远端；远端失败时写入本地图文索引。图文标签最多 6 个、单个最多 12 字；关联维度只接受 `moral`、`academic`、`sports`、`aesthetic`、`labor`。
- 图文响应推荐返回 `tags`、`dimension_keys`、`source`、`used_count`、`recent_used_at`、`last_used_dimension_key`、`last_used_section_key`、`last_used_item_id`；前端兼容对应 camelCase 字段。当前引用统计先在本机累计，后端接入后应提供按用户和材料 ID 原子递增的使用记录接口，避免多设备覆盖。
- 提交材料只在 `POST /evaluation-submissions` 成功返回后显示成功。
- 提交结果页会优先读取 `GET /evaluation-submissions/{submissionId}` 的服务端不可变详情；接口失败或离线时回退本地 `erkexitong-submission-history` 缓存，并展示当前使用的来源与错误原因。
- 提交前会校验必填文字、空记录、数值有效性和未上传图片；本地证明图片会先通过 `/upload` 上传后再提交，正式提交 loading 会展示本地证明图片上传序号。若提交前图片上传失败，失败弹窗会优先展示对应维度、条目和第几张证明图片，并可直接定位回对应证明记录、图片上传区域和失败图片缩略图，用户可对失败图片单张重传并替换原本地图片，替换成功后会提示重新提交。图片上传按钮可展示当前图片序号、缩略图、脱敏短文件名、进度、逐张状态和独立失败原因，缩略图加载失败时可降级为统一占位；多图上传中已成功的图片会先保留，真实失败/取消图片与尚未上传的“待重试”图片会分开标记，可整体重试剩余图片，也可单张重传或从重试队列移除。后端应提供稳定 `code` 和 `retryable`，避免前端长期依赖错误文案判断是否可重试。
- 提交前本地图片批量上传的前端进度快照会保留 `dimensionKey`、`sectionKey`、`itemId`、`recordId` 和 `imageIndex`，用于后续定位具体证明材料和失败图片。
- 评定记录可在 `records` 内保存 `noteReferences` 图文引用快照，包含图文 ID、标题、摘要、图片数量、可选标签、可选关联维度、引用时间和可选 `contentSnapshot` 内容块快照，用于提交后只读回看来源；旧数据缺少 `contentSnapshot` 时前端会用摘要生成兜底内容。
- 提交记录审核状态字段推荐使用 `review_status`，取值为 `draft`、`pending`、`reviewing`、`approved`、`returned`、`archived`；前端也兼容 `reviewStatus`、`status`、`audit_status` 和 `auditStatus`。
- 审核意见字段推荐使用 `review_comment`，退回原因使用 `return_reason`，审核人使用 `reviewer_name`，审核时间使用 `reviewed_at`；前端兼容对应 camelCase 字段。
- 前端审核统计目前由提交记录列表本地汇总，后端统计接口接入后应复用同一筛选口径；`submission_rate` 为非 `draft` 状态记录占比，`material_completion_rate` 为材料数大于 0 的记录占比，`dimension_stats` 应按维度返回平均得分、满分、得分率、分数缺口、材料数和问题数。
- 前端 CSV 导出字段由 `src/utils/submissionExport.ts` 统一生成；后端导出接口应复用提交记录列表筛选口径，并保持状态中文文案、五维得分和时间字段与前端一致。
- 前端监控事件由 `src/utils/monitoring.ts` 统一生成，`getMonitoringUploadPayload(limit)` 会按批次返回事件、接口失败聚合、关键操作计数、错误数量和本批次外剩余事件数；`src/services/monitoringService.ts` 会在配置 API 后 POST 到 `/frontend-monitoring-events`，只按后端返回的已接受事件 ID 清理。工具层会默认脱敏用户标识、正文、图片 URL、base64、密钥类字段和过长字符串。后端仍应做二次脱敏、采样、限流和 schema 校验；只应返回已接受的事件 ID，前端再调用 `clearMonitoringEvents(ids)` 清理。
- 前端兼容部分接口响应中的 snake_case 与 camelCase 字段，归一化逻辑集中在 service 层。
- 真实提交、图片上传、图文远端保存、提交历史远端读取和真实跨端流转都需要后端按本文件接口与事件契约实现。

## Local Storage Keys

| Key | 内容 |
| --- | --- |
| `erkexitong-session` | 登录态、用户 ID、token、设备 ID、设备名称、认证模式和用户角色 |
| `erkexitong-evaluation-draft` | 评定记录、已选项目和保存时间 |
| `erkexitong-note-draft` | 当前图文编辑草稿 |
| `erkexitong-note-index` | 图文材料本地索引与详情缓存 |
| `erkexitong-image-library` | 图片库本地缓存 |
| `erkexitong-image-library-filters` | 图片库筛选和排序偏好 |
| `erkexitong-submission-history` | 提交摘要历史 |

## Storage Schema

```sql
create table notes (
  id uuid primary key,
  user_id uuid not null,
  title varchar(255) not null,
  content jsonb not null default '[]',
  plain_text text not null default '',
  tags jsonb not null default '[]',
  dimension_keys jsonb not null default '[]',
  source varchar(16) not null default 'local',
  used_count int not null default 0,
  recent_used_at timestamptz,
  last_used_dimension_key varchar(64),
  last_used_section_key varchar(64),
  last_used_item_id varchar(128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table images (
  id uuid primary key,
  user_id uuid not null,
  original_url text not null,
  thumb_url text,
  width int,
  height int,
  size int,
  used_count int not null default 0,
  recent_used_at timestamptz,
  last_used_dimension_key varchar(64),
  last_used_section_key varchar(64),
  last_used_item_id varchar(128),
  uploaded_at timestamptz not null default now()
);

create table evaluation_submissions (
  id uuid primary key,
  user_id uuid not null,
  records jsonb not null default '{}',
  selected_item_ids jsonb not null default '[]',
  rule_version varchar(32) not null default 'unknown',
  total_score int not null default 0,
  material_count int not null default 0,
  issue_count int not null default 0,
  validation_issues jsonb not null default '[]',
  dimension_summaries jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index idx_notes_plain_text on notes using gin (to_tsvector('simple', plain_text));
create index idx_notes_tags on notes using gin (tags);
create index idx_notes_dimension_keys on notes using gin (dimension_keys);
create index idx_images_user_id on images (user_id);
create index idx_evaluation_submissions_user_id on evaluation_submissions (user_id);
```

图文内容统一使用 block 数组：

```json
[
  { "type": "heading", "text": "标题", "level": 2 },
  { "type": "paragraph", "text": "材料说明" },
  { "type": "image", "url": "https://cdn.example.com/a.jpg", "thumbUrl": "https://cdn.example.com/a_thumb.jpg" }
]
```

## WebSocket Events

客户端发送：

```json
{ "event": "auth", "payload": { "token": "...", "deviceId": "...", "deviceName": "Web H5" } }
```

```json
{ "event": "join", "payload": { "room": "student-001", "deviceId": "..." } }
```

```json
{ "event": "ping", "payload": { "time": 1710000000000, "deviceId": "web-lab" } }
```

```json
{
  "event": "client:transfer",
  "payload": {
    "messageId": "transfer_xxx",
    "sentAt": 1710000000000,
    "targetDevice": "broadcast",
    "action": "EDIT_ITEM",
    "payload": {
      "dimensionKey": "moral",
      "sectionKey": "base",
      "itemId": "moral-activity",
      "recordId": "record_xxx",
      "text": "参加宏德讲坛...",
      "images": []
    }
  }
}
```

图文材料流转：

```json
{
  "event": "client:transfer",
  "payload": {
    "messageId": "transfer_xxx",
    "sentAt": 1710000000000,
    "targetDevice": "broadcast",
    "action": "NOTE_CONTENT",
    "payload": {
      "noteId": null,
      "title": "德育活动图文材料",
      "tags": ["德育活动", "讲座"],
      "dimensionKeys": ["moral"],
      "source": "local",
      "content": [
        { "type": "paragraph", "text": "参加宏德讲坛..." }
      ]
    }
  }
}
```

接收端收到 `server:stateUpdate` 后回传投递确认：

```json
{
  "event": "client:transferAck",
  "payload": {
    "messageId": "transfer_xxx",
    "status": "delivered",
    "receivedAt": 1710000000500,
    "deviceId": "android-phone"
  }
}
```

服务端发送：

```json
{
  "event": "server:stateUpdate",
  "payload": {
    "messageId": "transfer_xxx",
    "action": "EDIT_ITEM",
    "targetDevice": "device_xxx",
    "fromDevice": "实验室 Web 端",
    "time": 1710000000000,
    "serverTime": 1710000000200,
    "payload": {}
  }
}
```

服务端把最终投递结果返回发送端；`status` 仅为 `delivered` 或 `failed`，失败时应提供可读 `error`：

```json
{
  "event": "server:transferAck",
  "payload": {
    "messageId": "transfer_xxx",
    "status": "delivered",
    "serverTime": 1710000000600
  }
}
```

`messageId` 是同一次流转及其手动重试的幂等键，重试时不得生成新 ID。客户端等待 ACK 10 秒；超时、断线或服务端返回 `failed` 时保留原载荷和目标设备供手动重试，不能把 Socket 写入成功等同于投递成功。

心跳响应：

```json
{ "event": "pong", "payload": { "time": 1710000000000 } }
```

```json
{
  "event": "server:deviceList",
  "payload": {
    "devices": [
      { "deviceId": "web-lab", "deviceName": "实验室 Web 端", "online": true }
    ]
  }
}
```
