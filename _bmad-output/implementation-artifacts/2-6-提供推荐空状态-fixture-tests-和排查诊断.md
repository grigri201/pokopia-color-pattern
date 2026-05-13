# Story 2.6: 提供推荐空状态、fixture tests 和排查诊断

Status: ready-for-dev

## Story

As a 维护者,
I want 推荐规则和异常状态有 fixture tests 与诊断字段,
so that 推荐质量问题可以复现和修复。

## Acceptance Criteria

1. Given 某只 Pokemon 自动推荐为空或少于 3 个 item, when 推荐 UI 渲染, then 页面展示可恢复空状态或 fallback 推荐状态, and 不承诺 fallback 是“最佳”推荐。
2. Given 推荐引擎 fixture tests 运行, when 测试覆盖偏好词命中、可染色 item、不可染色 item、OKLCH 分支、override 追加和 override 替换, then 所有关键规则都有确定性断言, and 失败信息能指出具体分支。
3. Given 维护者排查某个推荐条目, when 查看生成 JSON 或测试输出, then 可以定位命中偏好词、可染色状态、Pokemon 主色、item 主色、和谐判定、rank 和 pageIndex, and 推荐条目不缺少复现所需解释字段。

## Tasks / Subtasks

- [ ] 实现推荐空状态和 fallback 状态 (AC: 1)
  - [ ] 自动推荐为空或少于 3 个 item 时，UI 展示可恢复状态。
  - [ ] 文案避免“最佳”承诺，说明推荐基于当前数据和规则。
  - [ ] fallback 状态保留返回搜索/切换 Pokemon 的路径。
- [ ] 完整 fixture test 覆盖 (AC: 2)
  - [ ] 覆盖偏好词命中、可染色 item、不可染色 item、OKLCH pass/fail。
  - [ ] 覆盖 override append 和 override replace。
  - [ ] 失败信息包含 Pokemon slug、item slug 和规则分支。
- [ ] 生成诊断字段和报告 (AC: 3)
  - [ ] 推荐条目保留 matched terms、isDyeable、Pokemon/item primary color、harmony、rank、pageIndex。
  - [ ] 对被排除候选或 fallback 输出生成报告，便于排查。
- [ ] 接入 build/validation 命令 (AC: 2, 3)
  - [ ] fixture tests 接入 `package.json` 命令。
  - [ ] 推荐 schema/fixture 失败时非零退出。

## Dev Notes

- FR20 要求推荐为空或少于 3 个 item 时提供可恢复空状态或 fallback；这不是忽略错误，也不是随机补满。
- 诊断字段是产品能力的一部分：用户理解推荐原因、维护者复现推荐质量问题都依赖这些字段。
- Fixture tests 不能只测 happy path；必须覆盖偏好词、可染色、不可染色、OKLCH、override append、override replace。
- 空状态 UI 需要和后续 SSG 摘要的 fallback 行为一致，避免直接访问静态页与 hydrated 后结果不同。

### Project Structure Notes

- 预期路径：`tests/unit/recommendation.test.ts`、`tests/fixtures/*.json`、`generated/reports/generation-summary.json`、`src/app/render/inspector.ts`。
- 测试使用小 fixture 数据表达规则，不要依赖完整 live manifest 才能证明分支正确。
- 不要把诊断报告作为首屏必需 runtime data。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.6]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR20/FR45/FR46/FR47, NFR22/NFR23]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Build gate, Error Handling Patterns]
- [Source: `_bmad-output/project-context.md` - recommendation diagnostics and fallback rules]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
