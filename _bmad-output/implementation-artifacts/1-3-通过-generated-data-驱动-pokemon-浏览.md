# Story 1.3: 通过 generated data 驱动 Pokemon 浏览

Status: ready-for-dev

## Story

As a 用户,
I want Pokemon 浏览和详情页从 generated data 加载,
so that 页面首屏不再依赖完整 item manifest 作为运行时必需资源。

## Acceptance Criteria

1. Given `generated/data/pokemon-index.json` 和 `generated/data/compact-items.json` 已存在, when 用户打开应用, then 浏览器通过 `/data/pokemon-index.json` 和 `/data/compact-items.json` 加载运行时数据, and `src/main.ts` 不再 fetch `docs/pokopia_image_sources/item_portraits/manifest.csv` 作为首屏关键路径。
2. Given 用户在开发服务器中运行应用, when 浏览器请求 `/data/**`, then Vite dev 环境可以服务 generated data, and production build 可以把同一数据复制或输出到 `dist/data/**`。
3. Given generated data 请求失败或 JSON 无法解析, when 应用启动, then 页面显示可恢复错误状态, and 错误信息指向失败的数据文件而不是空白页。

## Tasks / Subtasks

- [ ] 新增 generated data client (AC: 1, 3)
  - [ ] 在 `src/data/client.ts` 或等价位置实现 `/data/pokemon-index.json`、`/data/compact-items.json` 加载。
  - [ ] 通过 schema 或类型守卫验证 JSON shape，失败时返回可恢复错误状态。
- [ ] 迁移 browser boot 数据来源 (AC: 1)
  - [ ] 将 `src/main.ts` 中 `POKEMON_MANIFEST` 和 `ITEM_MANIFEST` 的首屏 CSV fetch 迁移为 generated JSON fetch。
  - [ ] 保留当前 Pokemon 搜索、范围过滤、选中和 inspector 入口，不扩大为完整 UI 重写。
- [ ] 配置 dev/build 的 `/data/**` 服务 (AC: 2)
  - [ ] 更新 `vite.config.ts` 或等价脚本，让 dev server 能访问 `generated/data/**`。
  - [ ] production build 时将 generated data 复制或输出到 `dist/data/**`。
- [ ] 错误状态与可恢复路径 (AC: 3)
  - [ ] 数据文件缺失、JSON parse 失败、schema 失败时展示具体文件名和可恢复提示。
  - [ ] 不让页面停留在无限 loading 或空白 app shell。

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

TBD

### Debug Log References

### Completion Notes List

### File List
