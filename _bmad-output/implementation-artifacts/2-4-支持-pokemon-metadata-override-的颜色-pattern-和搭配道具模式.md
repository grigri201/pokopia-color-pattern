# Story 2.4: 支持 Pokemon metadata override 的颜色、pattern 和搭配道具模式

Status: done

## Story

As a 维护者,
I want 用结构化 override 修正 Pokemon 颜色、pattern 和搭配道具,
so that 自动生成不足时可以精确修正推荐体验。

## Acceptance Criteria

1. Given `data/overrides/pokemon-metadata.json` 定义某只 Pokemon 的主色、色板或 pattern, when 数据生成命令运行, then 输出 Pokemon metadata 使用 override 值, and 生成结果记录 override 来源。
2. Given override 为某只 Pokemon 定义搭配道具追加模式, when 推荐数据生成, then override items 被追加到自动推荐结果中, and 自动推荐仍保留，排序与 `overrideSource` 可追踪。
3. Given override 为某只 Pokemon 定义搭配道具替换模式, when 推荐数据生成, then 该 Pokemon 的推荐列表由 override items 替换自动推荐, and 替换行为通过 fixture test 覆盖。

## Tasks / Subtasks

- [x] 扩展 Pokemon metadata override schema (AC: 1, 2, 3)
  - [x] 支持 primary color、palette、pattern、recommended items append mode、recommended items replace mode。
  - [x] 校验 unknown slug、unknown item slug、重复 item 和非法模式。
- [x] 将 override 应用于 Pokemon metadata 生成 (AC: 1)
  - [x] override 主色/色板/pattern 优先于自动生成结果。
  - [x] 在输出记录 `overrideSource` 或等价字段，方便排查。
- [x] 将 override 应用于推荐生成 (AC: 2, 3)
  - [x] append 模式保留自动推荐，并追加 override items，排序和解释字段可追踪。
  - [x] replace 模式用 override items 替换自动推荐，仍需输出完整推荐条目字段。
- [x] 添加 fixture tests (AC: 2, 3)
  - [x] 覆盖颜色/色板/pattern override。
  - [x] 覆盖推荐 append 模式。
  - [x] 覆盖推荐 replace 模式。
- [x] [Review][Blocker] `harmonyStatus: "override"` 变更 recommendation contract 时 bump schema version 到 `recommendations.v2` [`src/data/schemas.ts`, `generated/data/recommendations/*.json`]
- [x] [Review][Patch] 推荐道具 override 不应污染 Pokemon metadata `overrideSource`/`overrideCount` [`scripts/generate-data.ts`, `src/domain/pokemon-metadata.ts`]
- [x] [Review][Patch] `harmonyStatus: "override"` 必须要求非空 `overrideSource` 且 `harmonyType: null` [`src/data/schemas.ts`]
- [x] [Review][Patch] append override 与自动推荐重复时不能静默覆盖自动解释字段 [`src/domain/recommendation-data.ts`]
- [x] [Review][Patch] unknown override item slug 的错误应指向 override JSON 文件和字段 [`src/domain/recommendation-data.ts`, `scripts/generate-data.ts`]
- [x] [Review][Patch] 拆分 invalid override schema fixture，避免 false-positive [`scripts/validate-color-fixtures.ts`]

## Dev Notes

- Override 是维护者输入，不能通过修改 raw `docs/pokopia_image_sources/**` 实现。
- Story 1.2 已建立 metadata override 基础；本故事扩展到 pattern 和搭配道具 append/replace。
- Append 和 replace 语义必须明确分开：append 不删除自动推荐，replace 用 override list 替换自动推荐。
- Override item 仍应通过 schema/lookup 校验，避免生成不存在图片或缺少 compact item metadata 的推荐条目。
- 排序与解释字段必须能显示 override 来源，支持后续 UI 和诊断。

### Project Structure Notes

- 预期路径：`data/overrides/pokemon-metadata.json`、`src/domain/pokemon-metadata.ts`、`src/domain/recommendation.ts`、`tests/fixtures/pokemon-overrides.fixture.json`。
- schema 可以放在 `src/data/schemas.ts` 或 `data/overrides/pokemon-metadata.schema.json`，但 Node 生成脚本和 tests 必须复用同一约束。
- 不要建立人工 override 管理后台；PRD 范围只要求结构化文件和脚本。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR38/FR39/FR40/FR46, NFR20/NFR23]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Data Architecture, Recommendation Architecture]
- [Source: `_bmad-output/project-context.md` - Pokemon metadata override rules]

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- 2026-05-13T20:32:17+0800: 进入 Story 2.4 实现，create-story 已存在，按默认 C 继续 dev-story。
- 2026-05-13T20:35:36+0800: 实现 `recommendedItems` append/replace override、推荐条目 `overrideSource` 追踪和 `harmonyStatus: "override"`；验证通过 `npm run generate:data`、`npm run validate:data`、`npm run validate:recommendations`、`npm run build`、`git diff --check`。
- 2026-05-13T20:45:22+0800: 修复三路 code review 发现的 1 个 blocker 和 patch/risk 项；重新通过 `npm run generate:data`、`npm run validate:data`、`npm run validate:recommendations`、`npm run validate:build`、`npm run build`、`git diff --check`。

### Completion Notes List

- `PokemonMetadataOverrideEntry` 新增 `recommendedItems`，支持 `mode: "append" | "replace"` 和带 `matchedPreferenceTerms` 的 item 列表。
- Recommendation data builder 支持 append/replace：append 保留自动推荐并让 override 条目按 `overrideSource` 排序靠前；replace 只输出 override 条目。
- Override 推荐条目会保留完整解释字段；不可染色且未通过 OKLCH 的人工条目使用 `harmonyStatus: "override"` 表达人工覆盖。
- Recommendation contract 升级为 `recommendations.v2`；schema 要求 override harmony 状态必须可追踪，append 与自动推荐重复会失败并指向 override 字段。
- Fixture 覆盖颜色/色板/pattern override、非法 recommended item override、unknown item、append 和 replace 行为。

### File List

- `src/data/schemas.ts`
- `src/domain/recommendation.ts`
- `src/domain/recommendation-data.ts`
- `src/domain/pokemon-metadata.ts`
- `scripts/generate-data.ts`
- `scripts/validate-color-fixtures.ts`
- `scripts/validate-recommendation-fixtures.ts`
- `generated/data/recommendations/*.json`
- `_bmad-output/implementation-artifacts/2-4-支持-pokemon-metadata-override-的颜色-pattern-和搭配道具模式.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-13: 增加 Pokemon metadata recommended item override schema 与 append/replace 推荐生成支持。
- 2026-05-13: Review 后升级 recommendation schema v2，并收紧 override 追踪、重复与错误定位校验。
