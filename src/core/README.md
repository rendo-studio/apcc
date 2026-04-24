---
name: APCC 核心层目录说明
description: 说明 src/core 预留用于共享领域模型、文件系统操作与结构化状态读写。
---

# src/core

该目录预留给 APCC 的共享核心逻辑。

后续实现应优先落在这里的内容包括：

- 文档包与 `.apcc` 的读写模型
- `goal / plan / task` 的领域对象，以及读取时派生的 status/progress 视图
- 元信息校验
- 同步与投影规则
