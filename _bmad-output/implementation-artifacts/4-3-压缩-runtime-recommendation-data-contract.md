# Story 4.3: 压缩 runtime recommendation/data contract

Status: ready-for-dev

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

- [ ] 拆分 runtime 与 build-only data (AC: 1, 2, 5)
  - [ ] 将 source traceability、source row、raw path 等 build-only 字段留在 `generated/**` 或 reports，不进入 runtime JSON。
  - [ ] 确保 runtime item index 足够让 UI 通过 `itemSlug` 解析展示字段。
- [ ] 收窄 recommendation entry schema (AC: 2, 3)
  - [ ] 更新 `src/data/schemas.ts` 中 recommendation schema/version。
  - [ ] 更新 `src/domain/recommendation-data.ts` 输出字段。
  - [ ] 更新 `src/main.ts` 渲染逻辑，从 item/Pokemon lookup 解析派生字段。
- [ ] 更新 validation budgets (AC: 4, 5)
  - [ ] `validate:recommendations` 或 `validate:build` 检查 dist recommendation raw/gzip totals。
  - [ ] 保留单 Pokemon gzip 小于 5 KiB。
  - [ ] compact runtime item data gzip 小于 50 KiB。
- [ ] 回归静态页和 smoke (AC: 1, 3)
  - [ ] `generate-ssg.ts` 生成推荐摘要时能用新 contract 解析 item display fields。
  - [ ] Playwright smoke 仍能看到推荐图片和推荐原因。

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

TBD

### Debug Log References

- TBD

### Completion Notes List

- TBD

### Review Results

- TBD

### File List

- TBD
