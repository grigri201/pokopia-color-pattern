# Story 3.2: 为全部 Pokemon 生成无 JS 可读静态详情页

Status: ready-for-dev

## Story

As a 用户,
I want 每只 Pokemon 都有可直接访问的静态详情页,
so that 分享链接和搜索结果打开时不需要等待客户端推荐计算才看到核心内容。

## Acceptance Criteria

1. Given production build 已生成 app assets、Pokemon metadata 和推荐数据, when SSG 生成命令运行, then 系统为全部 311 个 Pokemon 写入 `dist/pokemon/{slug}/index.html`, and 输出路径使用稳定 slug。
2. Given 用户在无 JS 或 JS 尚未加载时打开某个静态页, when 浏览器渲染 HTML, then 页面包含 Pokemon 名称、图片、主色、色板、文本色值和推荐摘要, and 页面不是空 app shell。
3. Given 静态页位于嵌套路由 `/pokemon/{slug}/`, when 浏览器加载 CSS、JS、图片和 JSON, then 资源 URL 使用 root-absolute path 或等价安全路径, and 不因相对路径错误导致资源 404。

## Tasks / Subtasks

- [ ] 实现 SSG 生成脚本 (AC: 1)
  - [ ] 新增 `scripts/generate-ssg.ts`，读取 `dist/index.html`、`generated/data/pokemon-index.json` 和 recommendation data。
  - [ ] 为全部 311 个 Pokemon 写入 `dist/pokemon/{slug}/index.html`。
- [ ] 生成 no-JS 核心内容 (AC: 2)
  - [ ] 静态 HTML 包含 Pokemon 名称、英文名、编号、图片、主色、色板文本值和推荐摘要。
  - [ ] 不是只包含 `<div id="app"></div>` 的空 shell。
- [ ] 处理嵌套路由资源路径 (AC: 3)
  - [ ] CSS、JS、图片、JSON 使用 root-absolute path 或等价安全路径。
  - [ ] 确认 `/pokemon/{slug}/` 下不会因相对路径找错 assets/data。
- [ ] 接入 production build 流程 (AC: 1)
  - [ ] 在 `package.json` 中将 SSG 命令放到 Vite build 后执行。
  - [ ] 保持 `dist/` 是唯一部署输出。

## Dev Notes

- SSG 必须在 Vite build 后读取 `dist/index.html` 和 generated data，写入 `dist/pokemon/{slug}/index.html`。
- 静态页首屏核心内容不得依赖客户端推荐计算完成后才出现。
- 当前 `index.html` 中脚本是 root-absolute `/src/main.ts`；build 后需要读取 Vite 产出的 asset references，不能硬编码 dev-only 脚本。
- `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 包含 311 个 Pokemon，是静态页范围来源。
- 静态页和 hydrated SPA 共享 generated data contract，不维护第二套推荐排序或分页逻辑。

### Project Structure Notes

- 预期路径：`scripts/generate-ssg.ts`、`dist/pokemon/{slug}/index.html`、`generated/data/pokemon-index.json`、`generated/data/recommendations/{slug}.json`。
- SSG 是 build-time Node script，不引入 Next/Astro/Remix 等框架迁移。
- 生成 HTML 时所有 manifest/generated 文本必须转义。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Static Access and Shareability, NFR4/NFR10/NFR12]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - SSG Strategy]
- [Source: `_bmad-output/project-context.md` - SSG no-JS readability rule]
- [Source: `index.html` - current app shell and root script]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
