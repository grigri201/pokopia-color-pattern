# Story 4.4: 建立 dist size budget 与部署校验 gate

Status: done

## Story

As a 维护者,
I want `npm run build` 自动验证 deployment size budget 和 runtime boundary,
so that deployment-blocking dist bloat 在合并前被发现。

## Acceptance Criteria

1. Given `npm run build` 完成, when `validate:dist` 运行, then 递归计算 `dist` logical byte size, and 要求小于 40 MiB。
2. Given `dist` 包含 raw source manifests、raw source image directories、unexpected data files 或 local absolute paths, when `validate:dist` 运行, then validation 非零失败, and 输出具体违规路径。
3. Given SSG pages 生成, when validation 检查全部静态页, then 全部 311 个 `/pokemon/{slug}/index.html` 仍存在, and static HTML 中图片 URL 指向 runtime asset path。
4. Given Playwright smoke 直接访问 `/pokemon/ditto/`, when hydrate 完成, then 页面展示 Ditto, and 推荐图片和 recommendation data 均使用 runtime distribution boundary。
5. Given build budget 被后续改动破坏, when `npm run build` 运行, then command 返回非零, and 不生成可误部署的 passing build。

## Tasks / Subtasks

- [x] 实现 dist 总体积校验 (AC: 1)
  - [x] 在 `validate:dist` 中递归统计 `dist` logical bytes。
  - [x] budget 固定为小于 40 MiB，并输出实际值和阈值。
- [x] 实现 forbidden output 校验 (AC: 2)
  - [x] 禁止 `dist/docs/pokopia_image_sources/**`。
  - [x] 禁止 raw source CSV/JSON manifest、build-only diagnostics 和 unexpected data files 进入 `dist`。
  - [x] 保持本地绝对路径、secret-like token scan。
- [x] 校验 runtime boundary 引用 (AC: 3, 4)
  - [x] 检查 SSG HTML 图片引用为 `/assets/runtime/**`。
  - [x] 检查 runtime JSON/JS/CSS/HTML 不引用 `/docs/pokopia_image_sources/**`。
  - [x] 检查 manifest 中所有 referenced runtime assets 存在。
- [x] 更新 smoke test 和 build gate (AC: 4, 5)
  - [x] Playwright 直接访问 `/pokemon/ditto/`，验证图片路径和 recommendation data 使用 runtime boundary。
  - [x] `npm run build` 继续串联 validate/generate/typecheck/Vite/SSG/dist/smoke。

## Dev Notes

- 本故事是 Epic 4 的 release gate；应在 Story 4.1-4.3 完成后执行。
- 不要只打印 warning；budget/source-boundary 失败必须让命令返回非零。
- `dist/` 不提交到 git，但它是 validation 的真实对象。

### Project Structure Notes

- 预期路径：`scripts/validate-build.ts`、`package.json`、`tests/smoke/pokemon-page.spec.ts`、`playwright.config.ts`。

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR52, NFR5/NFR24/NFR25/NFR30/NFR32/NFR33/NFR34]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Infrastructure & Deployment]
- [Source: `_bmad-output/project-context.md` - validate:dist rules]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- `npm run build:data-script`
- `npm run build`

### Completion Notes List

- `validate:dist` 递归统计 dist logical bytes，并以 40 MiB 作为硬性失败阈值。
- `validate:dist` 增强 forbidden output 检查，覆盖 raw source CSV、raw/build-only JSON diagnostics、unexpected data files、local absolute paths 和 secret-like token scan。
- 静态 Pokemon 页 validation 现在要求所有 `<img src>` 指向 `/assets/runtime/**`。
- Ditto Playwright smoke 现在验证 recommendation JSON 不含旧重复字段，并验证推荐卡图片使用 `/assets/runtime/items/*.webp`。
- Review 后补强：`ssg-generation-summary.json` 明确作为 build-only diagnostic 禁止进入 dist，并对全部 dist HTML/JS/CSS/JSON 文本面执行 local path/token scan。
- 当前 dist logical size：28,272,901 / 41,943,040 bytes。

### Review Results

- Multi-agent code review completed.
- P1 finding: forbidden-output 检查漏掉 `ssg-generation-summary.json`。Fixed by adding it to build-only forbidden file names.
- P1 finding: local path/token scan 未覆盖完整 deployable text surface。Fixed by scanning all dist HTML/CSS/JS/JSON files, including runtime asset manifest.
- Static/runtime boundary reviewer found no blocking issues: 311 static pages present, runtime image refs valid, manifest/files/references matched.
- Build/smoke reviewer found no blocking issues: `npm run build` chains validate/generate/typecheck/Vite/SSG/dist/smoke, and Ditto smoke covers runtime recommendation/image boundaries.

### File List

- `scripts/validate-build.ts`
- `tests/smoke/pokemon-page.spec.ts`

### Change Log

- 2026-05-14: Implemented dist size budget and deployment validation gate for Story 4.4.
- 2026-05-14: Addressed multi-agent code review findings and marked Story 4.4 done.
