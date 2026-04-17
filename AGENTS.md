# 项目上下文 — TanStack Start Full-Stack App

## gstack

可用 skills：
- `/office-hours` — 创意头脑风暴 / YC Office Hours 模式
- `/plan-ceo-review` — 战略视角 plan review
- `/plan-eng-review` — 架构视角 plan review
- `/plan-design-review` — 设计视角 plan review
- `/design-consultation` — 创建设计系统 / DESIGN.md
- `/design-shotgun` — 快速生成多种设计方案
- `/design-html` — 生成独立 HTML 设计原型
- `/review` — PR 合并前代码 review
- `/ship` — 完整发布流程（测试 → changelog → PR）
- `/land-and-deploy` — 落地并部署功能
- `/canary` — 金丝雀发布
- `/benchmark` — 性能基准测试
- `/browse` — 无头浏览器（截图、交互、验证）
- `/connect-chrome` — 连接 Chrome 浏览器
- `/qa` — 系统性 QA 测试并修复 bug
- `/qa-only` — 只输出 QA 报告，不修改代码
- `/design-review` — 视觉设计审查并修复
- `/setup-browser-cookies` — 导入浏览器 cookies
- `/setup-deploy` — 部署环境初始化
- `/retro` — 每周工程回顾
- `/investigate` — 系统性 debug（四阶段）
- `/document-release` — 发布后更新文档
- `/codex` — 使用 OpenAI Codex 进行对抗性代码 review
- `/cso` — 首席安全官视角安全 review
- `/autoplan` — 自动规划复杂任务
- `/plan-devex-review` — 开发者体验 review
- `/devex-review` — 开发者体验审查
- `/careful` — 危险命令安全守卫
- `/freeze` — 限制编辑范围到指定目录
- `/guard` — 最高安全模式（careful + freeze）
- `/unfreeze` — 解除编辑限制
- `/gstack-upgrade` — 升级 gstack 到最新版本
- `/learn` — 学习新技能

说明：所有网页浏览任务请优先使用 `/browse` skill，不要使用 `mcp__claude-in-chrome__*` 相关工具。

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "Working with TanStack Start core, server functions, middleware, or deployment"
    load: "node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md"
  - task: "Working with TanStack Router routing, loaders, navigation, or type safety"
    load: "node_modules/@tanstack/router-core/skills/router-core/SKILL.md"
  - task: "Working with TanStack Form validation, components, or form state"
    load: "node_modules/@tanstack/react-form/skills/react-form/SKILL.md"
  - task: "Working with TanStack Query data fetching, caching, or SSR integration"
    load: "node_modules/@tanstack/react-query/skills/react-query/SKILL.md"
  - task: "Working with TanStack DB collections, queries, or optimistic mutations"
    load: "node_modules/@tanstack/db/skills/db-core/SKILL.md"
  - task: "Working with TanStack AI chat, adapters, tool calling, or streaming"
    load: "node_modules/@tanstack/ai/skills/ai-core/SKILL.md"
  - task: "Configuring environment variables or .env files"
    load: "node_modules/dotenv/skills/dotenv/SKILL.md"
<!-- intent-skills:end -->

## 脚手架命令

```bash
npx @tanstack/cli@latest create my-tanstack-app --agent --deployment cloudflare --add-ons tanstack-query,better-auth,neon,drizzle,form,sentry
```

## TanStack Intent 初始化

```bash
npx @tanstack/intent@latest install
npx @tanstack/intent@latest list
```

## 技术栈与集成

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TanStack Start |
| 路由 | TanStack Router (文件系统路由) |
| 状态/数据 | TanStack Query + TanStack DB |
| 表单 | TanStack Form |
| 认证 | Better Auth |
| 数据库 | Neon (PostgreSQL) + Drizzle ORM |
| 监控 | Sentry |
| AI | TanStack AI (@tanstack/ai-react + @tanstack/ai-openai) |
| 构建 | Vite 8 |
| 部署 | Cloudflare Workers |
| 包管理 | bun |
| 工具链 | Biome (format + lint + check) |

## 环境变量

复制 `.env.example` 到 `.env.local` 并填写：

```bash
# Neon / PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/mydb"

# Better Auth
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<运行 npx -y @better-auth/cli secret 生成>

# Sentry
VITE_SENTRY_DSN=
VITE_SENTRY_ORG=
VITE_SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# OpenAI (可选，用于 TanStack AI demo)
OPENAI_API_KEY=
```

## 常用脚本

```bash
bun run dev          # 本地开发 (端口 3000)
bun run build        # 生产构建
bun run deploy       # 构建并部署到 Cloudflare
bun run test         # Vitest 测试
bun run check        # Biome 检查
bun run fix          # Biome 自动修复
bun run db:push      # Drizzle schema push
bun run db:studio    # Drizzle Studio
```

## Cloudflare 部署说明

- 使用 `@cloudflare/vite-plugin` 进行 SSR 环境集成
- `wrangler.jsonc` 包含 Workers 部署配置
- `deploy` 脚本会先执行 `vite build`，再调用 `wrangler deploy`
- 生产启动命令：`node --import ./dist/server/instrument.server.mjs dist/server/index.js`

## 关键架构决策

1. **文件系统路由**：所有页面放在 `src/routes/`，API 路由通过 `server.handlers` 定义在同一路由文件中。
2. **Server Functions**：使用 `createServerFn` 编写同构/服务端逻辑，与客户端组件无缝集成。
3. **TanStack Query SSR**：通过 `setupRouterSsrQueryIntegration` 在 router 中集成 QueryClient 的 SSR 脱水/注水。
4. **Biome 统一工具链**：用 Biome 替代 ESLint + Prettier，统一格式化、lint 和 import 排序。
5. **演示页面**：`src/routes/demo/` 下包含所有集成的独立演示页面（Query、Form、Better Auth、Drizzle、Neon、Sentry、TanStack DB、TanStack AI）。

## 新增集成（相对 CLI 默认输出）

- **TanStack DB**：新增 `@tanstack/react-db` + `@tanstack/query-db-collection`，提供 `src/routes/demo/tanstack-db.tsx` 本地优先数据库演示。
- **TanStack AI**：新增 `@tanstack/ai-react` + `@tanstack/ai-openai`，提供 `src/routes/demo/tanstack-ai.tsx` 聊天界面和 `src/routes/api/chat.ts` 流式服务端点。未配置 `OPENAI_API_KEY` 时会自动回退到模拟流式响应。

## 已知问题与注意事项

1. **TanStack CLI 的 `npm install` 在脚手架阶段可能失败**：项目已改用 `bun install` 重新安装依赖。
2. **Neon Launchpad 数据库 72 小时过期**：开发环境使用的 claimable 数据库会在 72 小时后失效，生产环境请使用持久化 Neon 项目。
3. **Sentry 需要额外配置**：`.env.local` 中的 Sentry 变量必须填写才能在构建时正确上传 source maps。
4. **Biome 与 Tailwind CSS v4**：`biome.json` 已启用 `css.parser.tailwindDirectives` 以支持 `@plugin` 和 `@theme` 语法。
5. **Better Auth Secret**：首次运行前必须生成 `BETTER_AUTH_SECRET`，否则认证功能无法正常工作。
6. **mock-interview 目录**：项目根目录下保留了一个已有的 `mock-interview` 子目录，Biome 已配置忽略该目录。
7. **构建输出目录**：当前 Vite 构建输出到 `dist/client` 和 `dist/server`，因此 `build`/`start` 脚本已修正为指向 `dist/server`。
8. **Vitest 与 Cloudflare 插件兼容性**：默认 `vite.config.ts` 中的 `cloudflare()` 插件会导致 Vitest 在 Workers runner 中启动失败。已创建独立的 `vitest.config.ts` 使用 `jsdom` 环境来规避此问题。

## 后续步骤

1. 填写 `.env.local` 中的敏感信息（Better Auth Secret、Sentry Token、Neon URL）。
2. 运行 `bun run db:push` 初始化数据库 schema。
3. 运行 `bun run dev` 启动开发服务器，访问 `/demo/*` 页面验证各集成。
4. 配置 Cloudflare 账户并运行 `bun run deploy` 进行首次部署。
5. 根据业务需求，将 `src/routes/demo/` 中的示例页面替换为实际业务页面。

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
