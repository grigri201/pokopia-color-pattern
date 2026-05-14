# Story 4.3: 压缩 runtime recommendation/data contract

Status: done

## Story

As a 维护者,
I want recommendation runtime data 不重复存储可从 item/Pokemon index 解析的字段,
so that `/data/recommendations/**` 体积可部署且解释能力仍可保留。

## Acceptance Criteria

1. Given browser 已加载 runtime item index, when recommendation JSON 加载, then UI 可以用 `itemSlug` 解析 item 名称、图片、分类、可染色状态和 item 主色。
2. Given recommendation entry 生成, when schema 校验运行, then entry 至少包含 `itemSlug`、`matchedPreferenceTerms`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`, and 不再重复存储可从 Pokemon index 或 runtime item index 派生的字段。
3. Given UI 展示推荐原因, when 用户查看推荐卡片, then `matchedPreferenceTerms`、可染色状态、主色、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex` 仍可展示或追踪。
4. Given `validate:recommendations` 或 `validate:dist` 运行, when recommendation data 体积校验执行, then `dist/data/recommendations/**` raw 小于 12 MiB, and `dist/data/recommendations/**` gzip 小于 800 KiB, and 单个 Pokemon recommendation gzip 小于 5 KiB。
5. Given compact runtime item data 生成, when gzip 体积校验运行, then compact runtime item data gzip 小于 50 KiB, and build-only traceability 不进入 runtime JSON。

## Tasks / Subtasks

- [x] 拆分 runtime 与 build-only data (AC: 1, 2, 5)
  - [x] 将 source traceability、source row、raw path 等 build-only 字段留在 build/reports，不进入 runtime compact item JSON。
  - [x] 确保 runtime item index 足够让 UI 通过 `itemSlug` 解析展示字段。
- [x] 收窄 recommendation entry schema (AC: 2, 3)
  - [x] 更新 `src/data/schemas.ts` 中 recommendation schema/version。
  - [x] 更新 `src/domain/recommendation-data.ts` 输出字段。
  - [x] 更新 `src/main.ts` 渲染逻辑，从 item/Pokemon lookup 解析派生字段。
- [x] 更新 validation budgets (AC: 4, 5)
  - [x] `validate:recommendations` / `validate:dist` 检查 recommendation raw/gzip totals。
  - [x] 保留单 Pokemon gzip 小于 5 KiB。
  - [x] compact runtime item data gzip 小于 50 KiB。
- [x] 回归静态页和 smoke (AC: 1, 3)
  - [x] `generate-ssg.ts` 生成推荐摘要时能用新 contract 解析 item display fields。
  - [x] Playwright smoke 仍能看到推荐图片和推荐原因。

## Dev Notes

- 当前 `dist/data/recommendations/**` raw 约 20.79 MiB；去掉 entry 中重复的 item name、image、category、Pokemon primary color 等字段后，估算可降至约 10.55 MiB raw / 0.62 MiB gzip。
- PRD 已允许推荐解释字段通过 recommendation entry 或 validated runtime lookup 共同复现；不要再把旧 NFR17 理解为每个字段都必须重复在 recommendation entry 中。
- 不要破坏 overrides 语义：overrides 是自动推荐的 overlay，空 overrides 仍应显示自动生成数据。

### Project Structure Notes

- 预期路径：`src/data/schemas.ts`、`src/domain/recommendation-data.ts`、`src/main.ts`、`scripts/generate-data.ts`、`scripts/generate-ssg.ts`、`scripts/validate-build.ts`、`tests/smoke/pokemon-page.spec.ts`。

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR36/FR52, NFR2/NFR3/NFR17/NFR21]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Generated Data Loading]
- [Source: `_bmad-output/project-context.md` - recommendation explanation contract]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- `npm run build:data-script`
- `npx tsc --noEmit`
- `npm run generate:data`
- `npm run generate:assets`
- `npm run validate:recommendations`
- `npm run validate:data`
- `npm run build`

### Completion Notes List

- Recommendation schema 升级为 `recommendations.v4`，entry 移除 item/Pokemon lookup 可派生字段，仅保留推荐解释、排序和 override 跟踪字段。
- Compact item schema 升级为 `compact-items.v3`，runtime JSON 移除 source traceability、source row、build-only preference/role 字段，并保留 UI lookup 所需的名称、图片、分类、tags、染色状态、染色变体和 item 主色。
- Browser UI 与 SSG 均通过 `itemSlug` 从 compact item index 解析名称、图片、分类、可染色状态和主色。
- `item-colors.json` 保留为 generated build-only data，不再复制到 `dist/data`。
- `pokemon-index.json` 与 runtime `asset-manifest.json` 移除 `generatedFrom`/raw boundary traceability，避免 raw source path 进入 runtime payload。
- schema validator 增加 runtime allowed-key 检查，并用负向 fixture 防止旧 recommendation/compact 字段回流。
- `validate:recommendations` 现在同时运行 recommendation raw/gzip/单文件预算 gate。
- 当前 `dist/data/recommendations/**`：raw 11,059,784 bytes，gzip 648,795 bytes，单文件最大 3,736 bytes；`dist/data/compact-items.json` gzip 40,686 bytes。

### Review Results

- Multi-agent code review completed.
- P1 finding: schema validators did not reject legacy/runtime-forbidden fields. Fixed by adding allowed-key checks for compact runtime data, recommendation entries, and runtime asset manifest rows, plus negative fixtures.
- P1 finding: runtime traceability leaked through `pokemon-index.json` and runtime `asset-manifest.json`. Fixed by removing runtime `generatedFrom` payloads and validating no raw source references in dist/runtime files.
- P2 finding: standalone `validate:recommendations` did not cover AC4 budgets. Fixed by adding `validate-build.js --recommendations` to that script.
- P3 finding: SSG did not explicitly consume item primary color from compact lookup. Fixed by rendering item primary color in static recommendation lines and validating it in `validate:dist`.

### File List

- `src/data/schemas.ts`
- `src/domain/recommendation-data.ts`
- `src/main.ts`
- `package.json`
- `scripts/generate-data.ts`
- `scripts/generate-runtime-assets.ts`
- `scripts/generate-ssg.ts`
- `scripts/validate-build.ts`
- `scripts/validate-recommendation-fixtures.ts`
- `tests/smoke/pokemon-page.spec.ts`
- `vite.config.ts`
- `generated/data/compact-items.json`
- `generated/data/pokemon-index.json`
- `generated/data/recommendations/*.json`

### Change Log

- 2026-05-14: Implemented compressed runtime recommendation/data contract for Story 4.3.
- 2026-05-14: Addressed multi-agent code review findings and marked Story 4.3 done.
