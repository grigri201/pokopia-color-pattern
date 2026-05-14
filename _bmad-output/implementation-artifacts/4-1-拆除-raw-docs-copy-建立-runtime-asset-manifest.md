# Story 4.1: 拆除 raw docs copy，建立 runtime asset manifest

Status: done

## Story

As a 维护者,
I want production build 不再复制完整 raw docs source，并有 runtime asset manifest 作为图片分发边界,
so that `dist` 不包含部署不需要的 source manifests 和重复图片目录。

## Acceptance Criteria

1. Given production build 运行, when Vite closeBundle 或等价 build copy step 执行, then 不再复制 `docs/pokopia_image_sources/**` 到 `dist/docs/**`, and `dist/docs/pokopia_image_sources/**` 不存在。
2. Given generated Pokemon index 和 recommendation data 已存在, when runtime asset manifest 生成, then manifest 覆盖全部 Pokemon image 和全部被推荐 item image, and manifest 条目包含 slug、source category、runtime path、byte size 和 content type。
3. Given browser 或 SSG 引用图片, when 读取 image path, then path 指向 `/assets/runtime/**`, and path 不指向 `/docs/pokopia_image_sources/**`。
4. Given `validate:dist` 运行, when `dist/docs/pokopia_image_sources/**` 存在或生产产物引用 `/docs/pokopia_image_sources/**`, then validation 非零失败。

## Tasks / Subtasks

- [x] 移除 raw docs production copy (AC: 1)
  - [x] 修改 `vite.config.ts`，删除或替换 `copy-pokopia-docs` 对 `docs/pokopia_image_sources/**` 的 dist copy。
  - [x] 保留 `/data/**` allowlist copy/serve 行为，不放宽 generated data tree。
- [x] 建立 runtime asset manifest contract (AC: 2)
  - [x] 从 `generated/data/pokemon-index.json` 与 `generated/data/recommendations/*.json` 推导需要的 Pokemon/item 图片集合。
  - [x] 为 manifest 定义 schema/type，记录 slug、source category、source path、runtime path、byte size、content type。
  - [x] 确保 manifest 覆盖 311 个 Pokemon image 和全部被推荐 item image。
- [x] 改写生产图片路径入口 (AC: 3)
  - [x] 更新 Pokemon index / compact item / recommendation data 或 runtime lookup，使 browser 和 SSG 使用 `/assets/runtime/**`。
  - [x] 保持开发环境可以解析同一 runtime URL contract。
- [x] 补强 dist validation (AC: 4)
  - [x] `validate:dist` 检查 `dist/docs/pokopia_image_sources/**` 不存在。
  - [x] `validate:dist` 扫描 HTML/JS/CSS/JSON，禁止 `/docs/pokopia_image_sources/**` 生产引用。
- [x] Review Follow-ups (AI)
  - [x] [High] 让 runtime path 扩展名与真实图片 content-type 一致，并在 manifest/schema/dist validation 中校验。
  - [x] [High] 让干净 checkout 的 `npm run dev` 自动生成被 gitignore 忽略的 runtime assets。
  - [x] [Medium] 对 `/assets/runtime/**` dev middleware 明确返回 400/404，不落入后续 fallback。
  - [x] [Medium] `validate:dist` 反向检查 runtime asset 文件不得缺失或超出 manifest 声明。
  - [x] [Medium] schema 层拒绝旧 `/docs/pokopia_image_sources/**` runtime 图片路径。
  - [x] [Low] runtime asset source copy 增加 realpath root 约束，避免 symlink 逃逸。

## Dev Notes

- Correct-course 决策：raw source 是 build input，不是 production distribution output。
- 旧实现中 `vite.config.ts` closeBundle 会复制完整 `docs/pokopia_image_sources` 到 `dist/docs/pokopia_image_sources`，这是 245M dist 的主要原因。
- runtime image path 必须兼容根路径 SPA 和 `/pokemon/{slug}/` 静态页，因此继续使用 root-absolute path。
- 本故事优先建立边界和 manifest；图片实际压缩可以在 Story 4.2 完成。

### Project Structure Notes

- 预期路径：`vite.config.ts`、`scripts/generate-data.ts`、`scripts/validate-build.ts`、`src/data/schemas.ts`、`generated/data/**`、`dist/assets/runtime/asset-manifest.json`。
- 不要提交 `dist/`；`dist` 只作为 build validation output。

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR49/FR50/FR51, NFR1/NFR5/NFR30/NFR31/NFR34]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Runtime Asset Architecture]
- [Source: `_bmad-output/project-context.md` - runtime asset boundary rules]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- `npm run build:data-script`
- `npm run generate:data`
- `npm run generate:assets`
- `npm run validate:data`
- `npm run validate:build`
- `npm run build`

### Completion Notes List

- 移除了 production build 中对 `docs/pokopia_image_sources/**` 的整目录复制，保留 `/data/**` allowlist serve/copy。
- 新增 `generate:assets`，从 build-only runtime asset source report 生成 `generated/assets/runtime/**` 与 `asset-manifest.json`，manifest 覆盖 311 个 Pokemon 和 1219 个 item，包含所有推荐 item。
- `generated/data/**` 的 Pokemon/item/recommendation 图片路径改为 `/assets/runtime/**`；Vite dev middleware 与 production copy 都使用同一 runtime URL contract。
- `validate:dist` 新增 raw docs 输出、`/docs/pokopia_image_sources/**` 生产引用和 runtime asset manifest 引用文件校验。
- 评审后补强了 clean dev 启动、schema runtime path 校验、content-type/extension 一致性、asset manifest 双向校验和 source realpath 约束。

### Review Results

- Code review found runtime boundary hardening issues: content-type/path extension mismatch, clean checkout dev startup gap, runtime asset middleware fallback, missing reverse manifest validation, schema-level old path acceptance, and source symlink escape risk.
- All review findings were addressed and `npm run build` passed afterward.

### File List

- `.gitignore`
- `package.json`
- `scripts/generate-data.ts`
- `scripts/generate-runtime-assets.ts`
- `scripts/smoke-story-1-4.ts`
- `scripts/validate-build.ts`
- `scripts/validate-recommendation-fixtures.ts`
- `src/data/schemas.ts`
- `tests/smoke/pokemon-page.spec.ts`
- `vite.config.ts`
- `generated/data/compact-items.json`
- `generated/data/item-colors.json`
- `generated/data/pokemon-index.json`
- `generated/data/recommendations/*.json`
- `generated/reports/recommendation-diagnostics.json`
- `generated/reports/runtime-asset-sources.json`

### Change Log

- 2026-05-14: Implemented runtime asset boundary and manifest generation for Story 4.1.
- 2026-05-14: Addressed code review findings and marked Story 4.1 done.
