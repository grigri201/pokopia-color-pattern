# Story 3.3: 为静态页提供唯一 metadata 和推荐摘要

Status: ready-for-dev

## Story

As a 用户,
I want 分享的 Pokemon 页面有清晰标题、描述和推荐摘要,
so that 接收链接的人能在打开前后理解页面内容。

## Acceptance Criteria

1. Given SSG 为某只 Pokemon 生成 HTML, when 页面写入 `<head>` 和正文摘要, then 每个静态页包含唯一 title 和 description, and metadata 与当前 Pokemon slug、名称和推荐摘要一致。
2. Given 某只 Pokemon 有推荐数据, when 静态页生成推荐摘要, then 摘要使用该 Pokemon 的推荐数据, and 不使用默认 Pokemon 或其他 slug 的推荐内容。
3. Given 某只 Pokemon 推荐为空或数据缺失, when 静态页生成, then 页面展示可恢复摘要或空状态, and 构建报告记录该 fallback。

## Tasks / Subtasks

- [ ] 生成唯一 head metadata (AC: 1)
  - [ ] 为每个 Pokemon 写入唯一 `<title>` 和 description。
  - [ ] metadata 使用当前 slug 对应的名称、主色/推荐摘要，不使用默认 Ditto。
- [ ] 生成正文推荐摘要 (AC: 1, 2)
  - [ ] 从 `generated/data/recommendations/{slug}.json` 读取当前 Pokemon 推荐摘要。
  - [ ] 摘要与 generated recommendation data 一致，不在 SSG 中重新排序。
- [ ] 缺失推荐 fallback 和报告 (AC: 3)
  - [ ] 推荐为空或文件缺失时写入可恢复摘要/空状态。
  - [ ] 构建报告记录 slug、fallback 类型和原因。
- [ ] 转义和隐私校验 (AC: 1, 3)
  - [ ] HTML 中所有名称、分类、原因字段经过转义。
  - [ ] metadata/report 不包含本机绝对路径、开发机用户名或私有环境值。

## Dev Notes

- 每个静态页必须包含唯一 title、description 和可读正文摘要；SEO 不是唯一目标，分享和快速访问同等重要。
- 推荐摘要必须来自同 slug 的 generated recommendation data，不能复用默认 Pokemon 或客户端 hydrate 后才补内容。
- 推荐为空时不要承诺“最佳推荐”；使用可恢复空状态或 fallback 摘要。
- 构建报告可以记录 fallback，但 runtime deterministic data 不应写入时间戳或私有路径。

### Project Structure Notes

- 预期路径：`scripts/generate-ssg.ts`、`generated/reports/build-validation.json` 或 `generated/reports/generation-summary.json`。
- 可添加小型 HTML helper，例如 `scripts/lib/escape-html.ts` 或复用共享 escape helper，但避免 Node/browser import 边界混乱。
- 不要把推荐摘要逻辑复制成另一套 ranking。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR28/FR29, NFR11]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Static Rendering & Hydration Architecture]
- [Source: `_bmad-output/project-context.md` - generated files privacy and fallback rules]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
