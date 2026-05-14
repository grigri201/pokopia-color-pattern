# Story 4.2: 生成优化后的 runtime image assets

Status: done

## Story

As a 用户,
I want Pokemon 和推荐 item 图片仍然清晰可见,
so that deployment size 降低时不牺牲核心视觉体验。

## Acceptance Criteria

1. Given raw Pokemon/item source images 存在, when asset generation 运行, then 仅为 runtime manifest allowlist 生成图片, and 不为未被 runtime 使用的 raw source image 生成 dist 资产。
2. Given Pokemon portrait 生成, when 检查 runtime image, then 最大边长不超过 420px, and 默认 WebP quality 82 或等价设置, and 单文件小于 64 KiB。
3. Given item portrait 生成, when 检查 runtime image, then 最大边长不超过 240px, and 默认 WebP quality 82 或等价设置, and 单文件小于 32 KiB。
4. Given generated runtime images, when `validate:dist` 运行, then runtime image 总体积小于 15 MiB, and 所有 manifest/runtime JSON/HTML 引用 path 都存在。
5. Given raw image 存在透明背景或 WebP-behind-PNG, when runtime image 生成, then 输出保持可见主体, and 不因扩展名和真实 content-type 不一致而失败。

## Tasks / Subtasks

- [x] 实现 runtime image generation (AC: 1, 2, 3)
  - [x] 使用现有 `sharp` 在 Node build script 中读取 source image。
  - [x] Pokemon 输出最大边长 420px，item 输出最大边长 240px。
  - [x] 默认输出 WebP quality 82 或等价设置。
- [x] 严格使用 allowlist (AC: 1)
  - [x] 只处理 manifest 中被 runtime 需要的 Pokemon/item source image。
  - [x] 不把未引用 raw source image 带入 `dist/assets/runtime/**`。
- [x] 记录并校验 asset metadata (AC: 4)
  - [x] manifest 记录 runtime path、byte size、content type、width/height。
  - [x] `validate:dist` 检查每个 manifest 引用文件存在。
  - [x] `validate:dist` 检查 runtime image 总体积和单文件 budget。
- [x] 覆盖格式边界 (AC: 5)
  - [x] 验证透明背景图片保持主体可见。
  - [x] 验证 WebP-behind-PNG 或扩展名不可信 source 仍能生成。
- [x] 修复 code review findings (AC: 1, 4)
  - [x] `validate:dist` 使用实际 `dist/assets/runtime/**` 文件大小和 `sharp` metadata 校验预算，而不是只信任 manifest 字段。
  - [x] generator 和 schema 明确锁定 runtime 输出为 `.webp`。
  - [x] generator 对重复 `runtimePath`、单文件预算和总量预算 fail-fast。
  - [x] `validate:dist` 双向校验 manifest 与 runtime data/HTML 引用集合。

## Dev Notes

- 上轮估算显示：Pokemon 420px + item 240px + WebP quality 82 可把实际 runtime image 集合压到约 8.95 MiB，低于 15 MiB budget。
- 不要用文件扩展名判断图片真实格式；应让 `sharp` 解码源文件。
- 如果质量或 byte budget 冲突，优先保留用户可识别主体，并在 PRD/architecture 中同步调整明确数值。

### Project Structure Notes

- 预期路径：`scripts/generate-data.ts` 或独立 `scripts/generate-runtime-assets.ts`、`scripts/validate-build.ts`、`dist/assets/runtime/**`。
- 生成过程应 deterministic：同一输入产生相同 runtime path 和 manifest ordering。

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR49/FR50, NFR31/NFR32/NFR34]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Runtime Asset Architecture / Image Optimization Defaults]
- [Source: `_bmad-output/project-context.md` - image generation and budget rules]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- `npm run build:data-script`
- `npm run generate:data`
- `npm run generate:assets`
- `npm run validate:data`
- `npm run build`

### Completion Notes List

- `scripts/generate-runtime-assets.ts` 使用 `sharp` 将 runtime allowlist 图片输出为 WebP quality 82，Pokemon 最大边 420px，item 最大边 240px。
- runtime data 图片路径统一改为 `.webp`，manifest 记录 `byteSize`、`contentType`、`width`、`height`。
- `validate:dist` 读取实际 dist 图片文件大小和 metadata，校验 runtime image 总量小于 15MiB、Pokemon 单文件小于 64KiB、item 单文件小于 32KiB，并检查尺寸上限和引用存在。
- generator 现在会在重复 `runtimePath`、单文件预算超限或总量预算超限时直接失败。
- runtime asset source report、runtime manifest、runtime data schema 均要求 `.webp` runtime path。
- 当前生成结果：1530 assets，总计 12,791,106 bytes；最大 Pokemon 33,366 bytes / 420px，最大 item 18,902 bytes / 240px。

### Review Results

- Code review completed in multi-agent mode.
- Blind Hunter finding: `validate:dist` 原先信任 manifest 自报 `byteSize`/dimensions；已改为检查实际 dist 文件和 `sharp` metadata。
- Blind Hunter finding: schema/source report 仍接受任意图片扩展；已收紧为 `.webp`。
- Edge Case Hunter finding: generator 缺少重复 `runtimePath` 防护和预算 fail-fast；已补齐。
- Edge Case Hunter finding: `validate:dist` 只校验引用在 manifest 中存在，未校验 manifest 资产都被 runtime 输出引用；已补齐反向校验。
- Acceptance Auditor result: no blocking findings.

### File List

- `scripts/generate-data.ts`
- `scripts/generate-runtime-assets.ts`
- `scripts/validate-build.ts`
- `scripts/validate-recommendation-fixtures.ts`
- `src/data/schemas.ts`
- `tests/smoke/pokemon-page.spec.ts`
- `generated/data/compact-items.json`
- `generated/data/pokemon-index.json`
- `generated/data/recommendations/*.json`
- `generated/reports/runtime-asset-sources.json`

### Change Log

- 2026-05-14: Implemented optimized runtime image asset generation for Story 4.2.
- 2026-05-14: Addressed multi-agent code review findings and marked Story 4.2 done.
