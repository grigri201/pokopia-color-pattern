# Story 2.4: 支持 Pokemon metadata override 的颜色、pattern 和搭配道具模式

Status: ready-for-dev

## Story

As a 维护者,
I want 用结构化 override 修正 Pokemon 颜色、pattern 和搭配道具,
so that 自动生成不足时可以精确修正推荐体验。

## Acceptance Criteria

1. Given `data/overrides/pokemon-metadata.json` 定义某只 Pokemon 的主色、色板或 pattern, when 数据生成命令运行, then 输出 Pokemon metadata 使用 override 值, and 生成结果记录 override 来源。
2. Given override 为某只 Pokemon 定义搭配道具追加模式, when 推荐数据生成, then override items 被追加到自动推荐结果中, and 自动推荐仍保留，排序与 `overrideSource` 可追踪。
3. Given override 为某只 Pokemon 定义搭配道具替换模式, when 推荐数据生成, then 该 Pokemon 的推荐列表由 override items 替换自动推荐, and 替换行为通过 fixture test 覆盖。

## Tasks / Subtasks

- [ ] 扩展 Pokemon metadata override schema (AC: 1, 2, 3)
  - [ ] 支持 primary color、palette、pattern、recommended items append mode、recommended items replace mode。
  - [ ] 校验 unknown slug、unknown item slug、重复 item 和非法模式。
- [ ] 将 override 应用于 Pokemon metadata 生成 (AC: 1)
  - [ ] override 主色/色板/pattern 优先于自动生成结果。
  - [ ] 在输出记录 `overrideSource` 或等价字段，方便排查。
- [ ] 将 override 应用于推荐生成 (AC: 2, 3)
  - [ ] append 模式保留自动推荐，并追加 override items，排序和解释字段可追踪。
  - [ ] replace 模式用 override items 替换自动推荐，仍需输出完整推荐条目字段。
- [ ] 添加 fixture tests (AC: 2, 3)
  - [ ] 覆盖颜色/色板/pattern override。
  - [ ] 覆盖推荐 append 模式。
  - [ ] 覆盖推荐 replace 模式。

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

TBD

### Debug Log References

### Completion Notes List

### File List
