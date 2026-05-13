# Story 2.2: 用 OKLCH 和谐判断筛选不可染色 item

Status: ready-for-dev

## Story

As a 用户,
I want 不可染色推荐 item 同时符合偏好词和 OKLCH 色彩和谐,
so that 推荐搭配具有可解释的视觉依据。

## Acceptance Criteria

1. Given 不可染色 item 已命中 Pokemon 偏好词, when 推荐引擎判断色彩关系, then 系统复用或薄封装 `docs/oklch_color.ts` 的 OKLCH 方法论, and 不使用 RGB 距离、HSL 色桶或另一套不一致的颜色接近规则。
2. Given 不可染色 item 未通过 OKLCH 和谐判断, when 推荐结果生成, then 该 item 不进入推荐结果, and 失败原因可在测试或生成报告中追踪。
3. Given 不可染色 item 通过 OKLCH 和谐判断, when 推荐结果生成, then 推荐条目包含 `harmonyStatus` 和 `harmonyType`, and harmony 类型来自共享色彩关系逻辑。

## Tasks / Subtasks

- [ ] 建立 OKLCH adapter (AC: 1)
  - [ ] 在 `src/domain/color-harmony.ts` 薄封装 `docs/oklch_color.ts` 的方法论。
  - [ ] 输出稳定的 `harmonyStatus` 和 `harmonyType`，供推荐条目和 UI 使用。
- [ ] 集成不可染色 item 分支 (AC: 2, 3)
  - [ ] 对 Story 2.1 标记的 `requiresHarmonyCheck` 候选运行 OKLCH 判断。
  - [ ] 未通过者从最终推荐结果中排除，并记录可追踪失败原因。
  - [ ] 通过者写入 `harmonyStatus`、`harmonyType` 和判断来源。
- [ ] 禁止不一致色彩规则 (AC: 1)
  - [ ] 不使用 `rgbToHsl`、RGB 距离或当前 `furnitureScore()` 作为推荐和谐源头。
  - [ ] 如需格式转换，只做输入适配，不改变 OKLCH 判定语义。
- [ ] 添加 fixture tests (AC: 1, 2, 3)
  - [ ] 覆盖不可染色 item 未通过 OKLCH 被排除。
  - [ ] 覆盖不可染色 item 通过 OKLCH 后携带 harmony 字段。
  - [ ] 覆盖可染色 item 不因 OKLCH 失败而被本分支过滤。

## Dev Notes

- `docs/oklch_color.ts` 是 OKLCH 方法论源头，推荐引擎只能复用或薄封装，不能另写 RGB/HSL/距离近似规则。
- 当前 `src/main.ts` 内的 `paletteTone()`、`furnitureScore()` 和 `colorDistance()` 是旧 runtime 体验辅助，不能成为新推荐引擎的和谐判定。
- 推荐条目必须保留解释字段，后续 Story 2.3 会补齐完整 required fields 和排序。
- `harmonyType` 应来自共享色彩关系逻辑，避免 UI、SSG 和数据生成各自产生不同文案/枚举。

### Project Structure Notes

- 预期路径：`src/domain/color-harmony.ts`、`src/domain/recommendation.ts`、`tests/unit/color-harmony.test.ts`、`tests/unit/recommendation.test.ts`。
- 如果 `docs/oklch_color.ts` 当前不在 tsconfig include 范围内，优先通过小 adapter 或构建脚本配置解决，不要复制一份会漂移的算法。
- Domain 文件保持 browser-safe；Node-only 文件系统逻辑放在 `scripts/**`。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Domain-Specific Requirements, NFR16/NFR22]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - OKLCH Rule]
- [Source: `_bmad-output/project-context.md` - docs/oklch_color.ts rule]
- [Source: `docs/oklch_color.ts` - OKLCH methodology source]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
