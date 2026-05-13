# Story 2.3: 生成 deterministic 推荐排序和解释字段

Status: ready-for-dev

## Story

As a 维护者,
I want 为每只 Pokemon 生成稳定排序、可解释的推荐数据,
so that 用户和排查者都能理解每个推荐为何出现。

## Acceptance Criteria

1. Given Pokemon metadata、compact item data、颜色数据和推荐候选已准备好, when 推荐生成命令运行, then 系统为每只 Pokemon 生成 `generated/data/recommendations/{slug}.json`, and 每个推荐文件包含 `schemaVersion`、`pokemonSlug`、`pageSize: 10`、`totalPages` 和推荐列表。
2. Given 推荐条目被写入 JSON, when schema 校验运行, then 每个条目包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`, and `pageIndex` 在数据中为 zero-based。
3. Given 同一输入数据和算法版本, when 推荐生成重复运行, then 排序按 override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit 和 item slug tie-breaker 稳定输出, and 单个 Pokemon 推荐数据 gzip 小于 5KB。

## Tasks / Subtasks

- [ ] 实现推荐数据生成器 (AC: 1)
  - [ ] 在 `scripts/generate-data.ts` 或配套模块中为每只 Pokemon 写入 `generated/data/recommendations/{slug}.json`。
  - [ ] 文件顶层包含 `schemaVersion`、`pokemonSlug`、`pageSize: 10`、`totalPages`、`recommendations`。
- [ ] 定义推荐条目 schema (AC: 2)
  - [ ] 每条推荐包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex`。
  - [ ] 对不适用字段使用 `null` 或明确枚举，不要省略导致 UI/SSG 分歧。
- [ ] 实现 deterministic ranking (AC: 3)
  - [ ] 排序键顺序为 override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit、item slug tie-breaker。
  - [ ] `rank` 从 1 开始稳定写入，`pageIndex` zero-based，`pageSize` 固定 10。
- [ ] 增加体积和重复生成校验 (AC: 3)
  - [ ] 单个 Pokemon 推荐数据 gzip 小于 5KB。
  - [ ] 同一输入重复生成内容稳定。

## Dev Notes

- 浏览器和 SSG 都消费推荐 JSON，不应在 runtime 重新计算推荐排序。
- `pageIndex` 在数据中是 zero-based；UI 可以显示 one-based page number。
- `overrideSource` 本故事先保留字段，Story 2.4 会实现 append/replace override 语义。
- 推荐数据不能包含当前时间、随机数、本机绝对路径或密钥。
- 推荐文件缺少字段会直接影响 Story 2.5 UI、Story 2.6 诊断和 Epic 3 静态摘要。

### Project Structure Notes

- 预期路径：`src/data/schemas.ts`、`src/domain/recommendation.ts`、`scripts/generate-data.ts`、`generated/data/recommendations/{slug}.json`。
- 生成器应聚合错误后非零退出，不要静默跳过某只 Pokemon。
- 不要把所有 Pokemon 推荐打包进首屏 JS；按 slug 分文件。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR17/FR18/FR34/FR36/FR47, NFR3/NFR14/NFR17]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Ranking Rule, Required Recommendation Fields]
- [Source: `_bmad-output/project-context.md` - recommendation explanation fields]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
