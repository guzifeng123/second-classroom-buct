# 接口与事件约定

## REST API

| 场景 | 方法与路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| 登录 | `POST /login` | `{ "userId": "student-001" }` | `{ "token": "...", "userId": "student-001" }` |
| 拉取快照 | `GET /snapshot/{userId}` | JWT Header | `{ "records": {}, "selectedItemIds": [], "savedAt": 1710000000000 }` |
| 保存草稿 | `PUT /evaluation-drafts/{userId}` | `{ "records": {}, "selectedItemIds": [], "savedAt": 1710000000000 }` | 同请求体 |
| 提交材料 | `POST /evaluation-submissions` | `{ "records": {} }` | `{ "submissionId": "uuid" }` |
| 获取提交记录 | `GET /evaluation-submissions?userId=student-001` | JWT Header | `{ "data": [], "total": 10 }` 或数组，记录项可包含 `records`、`selected_item_ids`、`rule_version`、`review_status`、`review_comment`、`return_reason`、`reviewer_name`、`reviewed_at`、`dimension_summaries`、`validation_issues` |
| 上传图片 | `POST /upload` | `multipart/form-data file` | `{ "id": "uuid", "original_url": "...", "thumb_url": "...", "width": 800, "height": 600, "size": 204800 }` |
| 创建图文材料 | `POST /notes` | `{ "title": "...", "content": [] }` | `{ "id": "uuid", "title": "...", "content": [], "plain_text": "..." }` |
| 查询图文材料 | `GET /notes?query=关键词` | JWT Header | `{ "data": [], "total": 10 }` 或数组 |
| 获取图文材料 | `GET /notes/{id}` | JWT Header | `{ "id": "uuid", "title": "...", "content": [] }` |
| 更新图文材料 | `PUT /notes/{id}` | `{ "title": "...", "content": [] }` | 更新后的完整对象 |
| 获取图片列表 | `GET /images?offset=0&limit=20` | JWT Header | `{ "data": [], "total": 100 }`，图片项可包含 `used_count`、`recent_used_at` 和最近关联条目 |

所有接口默认携带：

```text
Authorization: Bearer <token>
```

## Frontend Behavior Notes

- 未配置 `TARO_APP_API_BASE_URL` 时，前端进入离线演示模式：可登录、填报和本地暂存，但不能提交。
- 未配置 `TARO_APP_WS_BASE_URL` 时，流转按钮只记录离线演示历史，不建立真实 WebSocket，也不代表其他设备已收到内容。
- 评定页会同时读取本地草稿和远端快照；两边内容不一致时由用户确认使用本机或远端。
- 临时保存先写本地，再尝试同步远端；远端失败不丢弃本地草稿。
- 图文列表、图片库和提交历史优先读取远端；远端失败时回退本地缓存并展示错误信息。
- 图文保存先写本地图文草稿，再尝试写远端；远端失败时写入本地图文索引。
- 提交材料只在 `POST /evaluation-submissions` 成功返回后显示成功。
- 提交前会校验必填文字、空记录、数值有效性和未上传图片；本地证明图片会先通过 `/upload` 上传后再提交，正式提交 loading 会展示本地证明图片上传序号。若提交前图片上传失败，失败弹窗会优先展示对应维度、条目和第几张证明图片，并可直接定位回对应证明记录、图片上传区域和失败图片缩略图，用户可对失败图片单张重传并替换原本地图片，替换成功后会提示重新提交。图片上传按钮可展示当前图片序号、缩略图、脱敏短文件名、进度、逐张状态和独立失败原因，缩略图加载失败时可降级为统一占位；多图上传中已成功的图片会先保留，失败或取消后可整体重试剩余图片，也可单张重传或从重试队列移除。
- 提交前本地图片批量上传的前端进度快照会保留 `dimensionKey`、`sectionKey`、`itemId`、`recordId` 和 `imageIndex`，用于后续定位具体证明材料和失败图片。
- 评定记录可在 `records` 内保存 `noteReferences` 图文引用快照，包含图文 ID、标题、摘要、图片数量、引用时间和可选 `contentSnapshot` 内容块快照，用于提交后只读回看来源；旧数据缺少 `contentSnapshot` 时前端会用摘要生成兜底内容。
- 提交记录审核状态字段推荐使用 `review_status`，取值为 `draft`、`pending`、`reviewing`、`approved`、`returned`、`archived`；前端也兼容 `reviewStatus`、`status`、`audit_status` 和 `auditStatus`。
- 审核意见字段推荐使用 `review_comment`，退回原因使用 `return_reason`，审核人使用 `reviewer_name`，审核时间使用 `reviewed_at`；前端兼容对应 camelCase 字段。
- 前端兼容部分接口响应中的 snake_case 与 camelCase 字段，归一化逻辑集中在 service 层。
- 真实提交、图片上传、图文远端保存、提交历史远端读取和真实跨端流转都需要后端按本文件接口与事件契约实现。

## Local Storage Keys

| Key | 内容 |
| --- | --- |
| `erkexitong-session` | 登录态、用户 ID、token、设备 ID、设备名称和认证模式 |
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
    "targetDevice": "broadcast",
    "action": "NOTE_CONTENT",
    "payload": {
      "noteId": null,
      "title": "德育活动图文材料",
      "content": [
        { "type": "paragraph", "text": "参加宏德讲坛..." }
      ]
    }
  }
}
```

服务端发送：

```json
{
  "event": "server:stateUpdate",
  "payload": {
    "action": "EDIT_ITEM",
    "targetDevice": "device_xxx",
    "fromDevice": "实验室 Web 端",
    "time": 1710000000000,
    "payload": {}
  }
}
```

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
