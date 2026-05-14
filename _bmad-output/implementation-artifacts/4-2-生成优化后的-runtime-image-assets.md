# Story 4.2: 生成优化后的 runtime image assets

Status: ready-for-dev

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

- [ ] 实现 runtime image generation (AC: 1, 2, 3)
  - [ ] 使用现有 `sharp` 在 Node build script 中读取 source image。
  - [ ] Pokemon 输出最大边长 420px，item 输出最大边长 240px。
  - [ ] 默认输出 WebP quality 82 或等价设置。
- [ ] 严格使用 allowlist (AC: 1)
  - [ ] 只处理 manifest 中被 runtime 需要的 Pokemon/item source image。
  - [ ] 不把未引用 raw source image 带入 `dist/assets/runtime/**`。
- [ ] 记录并校验 asset metadata (AC: 4)
  - [ ] manifest 记录 runtime path、byte size、content type、width/height。
  - [ ] `validate:dist` 检查每个 manifest 引用文件存在。
  - [ ] `validate:dist` 检查 runtime image 总体积和单文件 budget。
- [ ] 覆盖格式边界 (AC: 5)
  - [ ] 验证透明背景图片保持主体可见。
  - [ ] 验证 WebP-behind-PNG 或扩展名不可信 source 仍能生成。

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

TBD

### Debug Log References

- TBD

### Completion Notes List

- TBD

### Review Results

- TBD

### File List

- TBD
