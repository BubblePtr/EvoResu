# TODOS — EvoResu

## P2

### 服务端持久化（Neon + Drizzle）

**What:** 将会话数据从 localStorage 迁移到 Neon 数据库，支持用户账户和跨设备访问。

**Why:** localStorage MVP 验证成功后，用户会有"换了电脑简历就没了"的痛点。服务端持久化是进入付费订阅的前提。

**Pros:** 解锁用户账户（Better Auth）、简历历史版本、多设备、数据分析。

**Cons:** 引入 Neon + Drizzle 数据模型，需要 schema 设计和迁移，Better Auth 集成，成本增加。

**Context:** 框架已有：`db/` 目录、Drizzle config、Neon 环境变量、Better Auth demo 页面。状态结构定义在 CEO Plan 的数据结构章节。localStorage 版本号字段（version: 1）需要在迁移时保留兼容性。

**Effort:** L（人工）→ M（CC+gstack）

**Depends on:** localStorage MVP 验证完成，用户有明确多设备需求信号

---

## P3

### 语音输入（Web Speech API）

**What:** 回答 AI 问题时，用户可点击麦克风讲话，转写内容自动填入文本框并可编辑。

**Why:** 部分用户在口述时比打字更容易表达细节，尤其是回忆具体经历时。

**Pros:** 降低输入门槛，可能提高单次会话的信息密度；无需外部 API，浏览器原生支持。

**Cons:** 浏览器兼容性不一致（Safari 支持较弱），噪音环境下转写质量差，需要麦克风权限 UX 设计。

**Context:** 设计文档已修订前提：语音是可选入口而非核心优势。先验证文字输入已经足够好，A/B 测试显示语音有显著优势后再做。实现参考 `Web Speech API SpeechRecognition`，无需 whisper。

**Effort:** M（人工）→ S（CC+gstack）

**Depends on:** 文字输入 MVP 已验证，有 A/B 数据支持
