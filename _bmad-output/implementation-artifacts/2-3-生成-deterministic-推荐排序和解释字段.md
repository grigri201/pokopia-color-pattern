# Story 2.3: 生成 deterministic 推荐排序和解释字段

Status: done

## Story

As a 维护者,
I want 为每只 Pokemon 生成稳定排序、可解释的推荐数据,
so that 用户和排查者都能理解每个推荐为何出现。

## Acceptance Criteria

1. Given Pokemon metadata、compact item data、颜色数据和推荐候选已准备好, when 推荐生成命令运行, then 系统为每只 Pokemon 生成 `generated/data/recommendations/{slug}.json`, and 每个推荐文件包含 `schemaVersion`、`pokemonSlug`、`pageSize: 10`、`totalPages` 和推荐列表。
2. Given 推荐条目被写入 JSON, when schema 校验运行, then 每个条目包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`, and `pageIndex` 在数据中为 zero-based。
3. Given 同一输入数据和算法版本, when 推荐生成重复运行, then 排序按 override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit 和 item slug tie-breaker 稳定输出, and 单个 Pokemon 推荐数据 gzip 小于 5KB。

## Tasks / Subtasks

- [x] 实现推荐数据生成器 (AC: 1)
  - [x] 在 `scripts/generate-data.ts` 或配套模块中为每只 Pokemon 写入 `generated/data/recommendations/{slug}.json`。
  - [x] 文件顶层包含 `schemaVersion`、`pokemonSlug`、`pageSize: 10`、`totalPages`、`recommendations`。
- [x] 定义推荐条目 schema (AC: 2)
  - [x] 每条推荐包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex`。
  - [x] 对不适用字段使用 `null` 或明确枚举，不要省略导致 UI/SSG 分歧。
- [x] 实现 deterministic ranking (AC: 3)
  - [x] 排序键顺序为 override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit、item slug tie-breaker。
  - [x] `rank` 从 1 开始稳定写入，`pageIndex` zero-based，`pageSize` 固定 10。
- [x] 增加体积和重复生成校验 (AC: 3)
  - [x] 单个 Pokemon 推荐数据 gzip 小于 5KB。
  - [x] 同一输入重复生成内容稳定。
- [x] [Review][Patch] 真实非空推荐生成路径需要 fixture 覆盖完整 JSON 条目和排序 [`src/domain/recommendation-data.ts`, `scripts/validate-recommendation-fixtures.ts`]
- [x] [Review][Blocker] 限制 generated data 分发树，避免陈旧额外文件绕过敏感信息扫描并进入 `dist/data` [`scripts/validate-build.ts`, `vite.config.ts`]
- [x] [Review][Patch] schema 必须校验数组顺序与 `rank/pageIndex` 一致 [`src/data/schemas.ts`]
- [x] [Review][Patch] 推荐条目必须包含非空规范化 `matchedPreferenceTerms` [`src/data/schemas.ts`]
- [x] [Review][Patch] item color 一致性校验不能跳过 nullable 值 [`scripts/generate-data.ts`]
- [x] [Review][Patch] 自动推荐不能继承 Pokemon metadata overrideSource [`src/domain/recommendation-data.ts`]

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

GPT-5

### Debug Log References

- 2026-05-13T20:11:08+0800: 进入 Story 2.3 实现，create-story 已存在，按默认 C 继续 dev-story。
- 2026-05-13T20:17:25+0800: 生成 311 个 per-Pokemon recommendation JSON，真实数据当前因无偏好词输出合法空列表；ranking 通过 fixture 覆盖。
- 2026-05-13T20:17:25+0800: 验证通过：`npm run generate:data`、`npm run validate:data`、`npm run validate:recommendations`、`npm run validate:build`、`npm run build`、`git diff --check`。
- 2026-05-13T20:29:20+0800: 修复三路 code review 发现的 1 个 blocker 和 5 个 patch/risk 项，重新通过 `npm run validate:data`、`npm run validate:recommendations`、`npm run validate:build`、`npm run build`、`git diff --check`。

### Completion Notes List

- 新增 `recommendations.v1` schema 和 per-entry 解释字段校验，强制 `rank`、zero-based `pageIndex`、`pageSize: 10` 与 harmony nullability。
- `scripts/generate-data.ts` 现在按 Pokemon slug 写入 `generated/data/recommendations/{slug}.json`，并在生成/validate-only 两条路径校验文件数量、schema、体积和私有路径。
- 排序规则抽到 `src/domain/recommendation.ts`，per-Pokemon recommendation JSON builder 抽到 `src/domain/recommendation-data.ts`，fixture 覆盖非空推荐条目、override priority、偏好词强度、可染色分支、harmony 类型和 slug tie-breaker。
- `validate-build` 和 Vite generated data serving/copying 均按 Pokemon index 派生 allowlist，额外 runtime data 文件或目录会失败。

### File List

- `src/data/schemas.ts`
- `src/domain/recommendation.ts`
- `src/domain/recommendation-data.ts`
- `scripts/generate-data.ts`
- `scripts/validate-build.ts`
- `scripts/validate-recommendation-fixtures.ts`
- `vite.config.ts`
- `generated/data/recommendations/*.json`
- `_bmad-output/implementation-artifacts/2-3-生成-deterministic-推荐排序和解释字段.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-13: 实现 deterministic recommendation data generation、schema validation、ranking fixture 和 build gate。
