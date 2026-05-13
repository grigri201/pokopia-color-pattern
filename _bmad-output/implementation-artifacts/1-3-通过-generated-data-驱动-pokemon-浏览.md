# Story 1.3: 通过 generated data 驱动 Pokemon 浏览

Status: done

## Story

As a 用户,
I want Pokemon 浏览和详情页从 generated data 加载,
so that 页面首屏不再依赖完整 item manifest 作为运行时必需资源。

## Acceptance Criteria

1. Given `generated/data/pokemon-index.json` 和 `generated/data/compact-items.json` 已存在, when 用户打开应用, then 浏览器通过 `/data/pokemon-index.json` 和 `/data/compact-items.json` 加载运行时数据, and `src/main.ts` 不再 fetch `docs/pokopia_image_sources/item_portraits/manifest.csv` 作为首屏关键路径。
2. Given 用户在开发服务器中运行应用, when 浏览器请求 `/data/**`, then Vite dev 环境可以服务 generated data, and production build 可以把同一数据复制或输出到 `dist/data/**`。
3. Given generated data 请求失败或 JSON 无法解析, when 应用启动, then 页面显示可恢复错误状态, and 错误信息指向失败的数据文件而不是空白页。

## Tasks / Subtasks

- [x] 新增 generated data client (AC: 1, 3)
  - [x] 在 `src/data/client.ts` 或等价位置实现 `/data/pokemon-index.json`、`/data/compact-items.json` 加载。
  - [x] 通过 schema 或类型守卫验证 JSON shape，失败时返回可恢复错误状态。
- [x] 迁移 browser boot 数据来源 (AC: 1)
  - [x] 将 `src/main.ts` 中 `POKEMON_MANIFEST` 和 `ITEM_MANIFEST` 的首屏 CSV fetch 迁移为 generated JSON fetch。
  - [x] 保留当前 Pokemon 搜索、范围过滤、选中和 inspector 入口，不扩大为完整 UI 重写。
- [x] 配置 dev/build 的 `/data/**` 服务 (AC: 2)
  - [x] 更新 `vite.config.ts` 或等价脚本，让 dev server 能访问 `generated/data/**`。
  - [x] production build 时将 generated data 复制或输出到 `dist/data/**`。
- [x] 错误状态与可恢复路径 (AC: 3)
  - [x] 数据文件缺失、JSON parse 失败、schema 失败时展示具体文件名和可恢复提示。
  - [x] 不让页面停留在无限 loading 或空白 app shell。

### Review Findings

- [x] [Review][Patch] 非法 percent 编码会让 `/data/**` dev middleware 抛异常 [`vite.config.ts`]
- [x] [Review][Patch] `generated/data` 下外部 symlink 会经 `/data/**` 暴露或落入错误 fallback [`vite.config.ts`]
- [x] [Review][Patch] 空 Pokemon index 启动失败时没有归因到具体 generated data 文件 [`src/data/schemas.ts`]
- [x] [Review][Patch] production build 可在缺失运行时 generated data 时静默成功 [`vite.config.ts`]
- [x] [Review][Patch] item event 元数据被 generated data 映射无条件丢弃 [`src/data/schemas.ts`, `scripts/generate-data.ts`, `src/main.ts`]

## Dev Notes

- 这是移除首屏重 manifest 的关键故事。当前 `src/main.ts` 的 `boot()` 会 Promise.all fetch Pokemon CSV 和 item CSV，必须改为静态 JSON boundary。
- 浏览器运行时 static data API 是 `/data/pokemon-index.json`、`/data/compact-items.json`、后续 `/data/recommendations/{slug}.json`；本故事只要求前两个。
- `vite.config.ts` 已有 `copy-pokopia-docs` 插件在 build 后复制 raw docs 到 `dist/docs/pokopia_image_sources`；新增 generated data 复制要兼容该插件，不要删除现有行为。
- Generated data 请求失败要保留搜索/导航可恢复能力的基础结构；后续 story 会继续增强推荐数据失败场景。
- 用户可见错误文本使用 DOM text API 或 `escapeHtml`，不要把 manifest/JSON 字段直接插入 `innerHTML`。

### Project Structure Notes

- 预期路径：`src/data/client.ts`、`src/data/types.ts`、`src/app/boot.ts` 或渐进式重构后的 `src/main.ts`。
- `src/main.ts` 可以先保留为单文件渐进修改，但新增 build-time/raw parsing 逻辑不应继续放在浏览器入口。
- `generated/data/**` 是源生成产物，`dist/data/**` 是分发产物。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` - NFR1/NFR21/NFR26]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Generated Data Loading, API & Communication Patterns]
- [Source: `_bmad-output/project-context.md` - Framework-Specific Rules]
- [Source: `src/main.ts` - current CSV fetch boot path]
- [Source: `vite.config.ts` - current static copy plugin]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run validate:data`
- `npm run build`
- `curl -I http://127.0.0.1:5175/data/pokemon-index.json`
- `curl -s http://127.0.0.1:5175/data/compact-items.json | head -c 120`
- `node -e '...'` 验证缺失 `generated/data/pokemon-index.json` 时 production build fail-fast
- `curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:5176/data/%E0%A4%A'`
- `node -e '...'` 验证 `/data/**` 拒绝指向外部文件的 symlink

### Completion Notes List

- 新增浏览器端 generated data client，以 `/data/pokemon-index.json` 和 `/data/compact-items.json` 为唯一首屏数据边界，并复用 schema 校验错误。
- `src/main.ts` 已停止首屏读取 Pokemon/item manifest CSV，改用 generated JSON 初始化 Pokemon 列表、色板和 item 展示数据。
- Vite dev middleware 将 `/data/**` 映射到 `generated/data/**`，production build 复制同一目录到 `dist/data/**`。
- 启动失败时 loading 区域展示失败文件和恢复提示，避免空白页或无限 loading。
- Review 后补齐 `/data/**` 非法路径和 symlink 防护，production build 缺必需 generated data 直接失败。
- Compact item data 保留 `event` 字段，运行时 item meta 不再丢失活动信息。

### File List

- `src/data/client.ts`
- `src/data/schemas.ts`
- `src/main.ts`
- `src/styles.css`
- `scripts/generate-data.ts`
- `vite.config.ts`
- `generated/data/compact-items.json`
- `_bmad-output/implementation-artifacts/1-3-通过-generated-data-驱动-pokemon-浏览.md`

### Change Log

- 2026-05-13: 迁移首屏运行时数据加载到 generated JSON，并增加 `/data/**` dev/build 服务。
