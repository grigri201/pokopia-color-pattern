# Story 3.4: 验证静态输出、hydrate parity 和 production build gate

Status: ready-for-dev

## Story

As a 维护者,
I want 自动验证静态页、推荐数据和 hydrate 一致性,
so that 可分享页面不会在发布时退化。

## Acceptance Criteria

1. Given production build command 运行, when 生成 compact data、推荐数据和 SSG 页面后进入 validation, then validation 确认全部 311 个 `/pokemon/{slug}/` 页面存在, and 确认每只 Pokemon 都有推荐数据产物。
2. Given validation 抽样检查固定 fixture 页，例如 `ditto`, when 检查 `dist/pokemon/ditto/index.html`, then 页面包含标题、图片、主色、色板和推荐摘要, and 静态页面与 generated data 的 slug 一致。
3. Given 浏览器 smoke test 运行, when 直接访问一个静态 Pokemon 页并完成 hydrate, then hydrate 后页面展示的 Pokemon 与路径 slug 一致, and 搜索、切换、筛选和分页能力仍可用。

## Tasks / Subtasks

- [ ] 实现 build output validation (AC: 1, 2)
  - [ ] 新增 `scripts/validate-build.ts`，检查 311 个 `dist/pokemon/{slug}/index.html` 存在。
  - [ ] 检查每只 Pokemon 都有 `generated/data/recommendations/{slug}.json` 或 dist 对应推荐产物。
  - [ ] 抽样检查 `ditto` 页面包含 title、图片、主色、色板、推荐摘要。
- [ ] 校验静态页与 generated data slug 一致 (AC: 2)
  - [ ] 从 generated Pokemon index 读取 slug 列表，避免手写数量。
  - [ ] 检查静态 HTML 不包含默认 Pokemon 错配内容。
- [ ] 添加 browser smoke test (AC: 3)
  - [ ] 使用 Playwright 或架构批准的轻量 smoke，直接访问 `/pokemon/{slug}/`。
  - [ ] 验证 hydrate 后显示路径 slug 的 Pokemon，搜索、切换、筛选、分页仍可用。
- [ ] 完成 production build gate (AC: 1, 3)
  - [ ] `npm run build` 或明确 release gate 执行 generate data、tests、typecheck、Vite build、SSG、validation、smoke。
  - [ ] 任一校验失败时非零退出并打印可操作路径。

## Dev Notes

- NFR24 要求全部 311 个 `/pokemon/{slug}/` 页面存在，并抽样验证 `ditto` 等固定 fixture 页包含标题、图片、主色、色板和推荐摘要。
- NFR25 要求浏览器 smoke test 覆盖直接访问静态页并 hydrate。
- 当前仓库没有 Vitest/Jest/Playwright 配置；引入测试工具时保持轻量并接入 `package.json`。
- `npm run build` 当前不是完整 production gate；本故事应把前面 Epic 的 generation/recommendation/SSG/validation 串起来。
- Validation 需要聚合错误，输出具体 slug、文件路径和失败原因。

### Project Structure Notes

- 预期路径：`scripts/validate-build.ts`、`tests/smoke/pokemon-page.spec.ts`、`playwright.config.ts`（如引入）、`package.json` scripts。
- Browser smoke 可以在 CI 可用时运行；本地 release gate 至少要有可执行命令和明确跳过/失败策略。
- 不要把 `dist/` 作为 source of truth 提交，除非后续 story 明确要求提交 deterministic generated output。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR30/FR43/FR44/FR48, NFR24/NFR25/NFR26]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Build gate, Validation Results]
- [Source: `_bmad-output/project-context.md` - Testing Rules and Development Workflow Rules]
- [Source: `package.json` - current incomplete build gate]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
