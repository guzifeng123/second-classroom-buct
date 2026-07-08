# 二课系统技术规范文档索引

本文档是学生综合素质评定系统跨端前端的技术规范入口，面向团队开发、维护交接和后续功能扩展。当前仓库主体位于 `erkexitong`，项目定位为 Taro 3 + React + TypeScript 跨端前端，覆盖 H5、微信小程序和 Android React Native。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [01-framework-architecture.md](./01-framework-architecture.md) | 项目框架、模块划分、页面结构、状态管理、服务层和数据流转 |
| [02-tech-stack-and-languages.md](./02-tech-stack-and-languages.md) | 技术栈版本、目标平台、涉及语言、构建工具和运行命令 |
| [03-development-standards.md](./03-development-standards.md) | 团队开发规范、目录职责、组件/API/状态管理约定和跨端注意事项 |
| [api.md](./api.md) | REST API、Storage Schema 和 WebSocket 事件约定 |

## 适用范围

这些规范适用于当前前端工程的日常开发，包括页面开发、组件维护、状态管理、接口封装、图片上传、图文材料编辑、评定预览、提交记录、跨设备流转和多端构建。

不包含后端服务实现细节。后端相关内容只记录前端已依赖的接口、事件和存储结构约定，具体以后端实际实现为准。

## 项目定位

- 系统名称：学生综合素质评定系统。
- 工程名称：`erkexitong`。
- 工程类型：跨端前端应用。
- 主要端：H5、微信小程序、Android React Native。
- 主要能力：登录、综合素质评定填报、提交前预览、正式提交、提交记录查看、图文材料库、图文材料编辑、图片选择与上传、图片库、跨设备内容流转、草稿暂存。

## 当前页面入口

页面以 `src/app.config.ts` 为准，当前注册：

| 页面 | 路径 |
| --- | --- |
| 登录页 | `pages/login/index` |
| 评定页 | `pages/evaluation/index` |
| 提交前预览页 | `pages/evaluation/preview/index` |
| 图文材料列表页 | `pages/note/list/index` |
| 图文编辑页 | `pages/note/edit/index` |
| 图片库页 | `pages/image/library/index` |
| 提交结果页 | `pages/submission/result/index` |
| 提交历史页 | `pages/submission/history/index` |
| 状态说明页 | `pages/error/index` |

## 建议阅读顺序

1. 先读 [02-tech-stack-and-languages.md](./02-tech-stack-and-languages.md)，确认项目用到的框架、语言和命令。
2. 再读 [01-framework-architecture.md](./01-framework-architecture.md)，理解页面、状态、服务和数据流。
3. 开始开发前读 [03-development-standards.md](./03-development-standards.md)，按团队约定新增代码。
4. 涉及接口、上传、草稿、流转事件时，配合阅读 [api.md](./api.md)。

## 维护原则

- 技术栈版本以 `package.json` 和 `package-lock.json` 为准。
- 接口与事件以 `docs/api.md` 为准。
- 页面列表以 `src/app.config.ts` 为准。
- 服务层列表以 `src/services` 为准。
- 新增模块后，应同步更新对应规范文档，避免文档与源码脱节。
