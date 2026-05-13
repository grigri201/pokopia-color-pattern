# Story 3.3: 为静态页提供唯一 metadata 和推荐摘要

Status: done

## Story

As a 用户,
I want 分享的 Pokemon 页面有清晰标题、描述和推荐摘要,
so that 接收链接的人能在打开前后理解页面内容。

## Acceptance Criteria

1. Given SSG 为某只 Pokemon 生成 HTML, when 页面写入 `<head>` 和正文摘要, then 每个静态页包含唯一 title 和 description, and metadata 与当前 Pokemon slug、名称和推荐摘要一致。
2. Given 某只 Pokemon 有推荐数据, when 静态页生成推荐摘要, then 摘要使用该 Pokemon 的推荐数据, and 不使用默认 Pokemon 或其他 slug 的推荐内容。
3. Given 某只 Pokemon 推荐为空或数据缺失, when 静态页生成, then 页面展示可恢复摘要或空状态, and 构建报告记录该 fallback。

## Tasks / Subtasks

- [x] 生成唯一 head metadata (AC: 1)
  - [x] 为每个 Pokemon 写入唯一 `<title>` 和 description。
  - [x] metadata 使用当前 slug 对应的名称、主色/推荐摘要，不使用默认 Ditto。
- [x] 生成正文推荐摘要 (AC: 1, 2)
  - [x] 从 `generated/data/recommendations/{slug}.json` 读取当前 Pokemon 推荐摘要。
  - [x] 摘要与 generated recommendation data 一致，不在 SSG 中重新排序。
- [x] 缺失推荐 fallback 和报告 (AC: 3)
  - [x] 推荐为空或文件缺失时写入可恢复摘要/空状态。
  - [x] 构建报告记录 slug、fallback 类型和原因。
- [x] 转义和隐私校验 (AC: 1, 3)
  - [x] HTML 中所有名称、分类、原因字段经过转义。
  - [x] metadata/report 不包含本机绝对路径、开发机用户名或私有环境值。

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

GPT-5 Codex

### Debug Log References

- `npm run build:data-script`
- `npx tsc --noEmit`
- `npm run build`
- `rg -n "<title>|description|og:title|og:description|twitter:description|data-recommendation-summary|当前数据和规则暂未产生推荐搭配" dist/pokemon/ditto/index.html`
- `sed -n '1,80p' generated/reports/ssg-generation-summary.json`
- `rg -n "canonical|og:url|og:image|twitter:image|description|data-recommendation-summary|static-empty" dist/pokemon/ditto/index.html`
- `git diff --check`

### Completion Notes List

- SSG 为每个静态 Pokemon 页面写入唯一 title、description、Open Graph 和 Twitter summary metadata，内容基于当前 slug、名称、主色和同 slug 推荐摘要生成。
- 正文推荐摘要继续读取 `generated/data/recommendations/{slug}.json` 的原始排序，不在 SSG 中重新排序。
- 推荐为空或推荐文件缺失时静态页展示可恢复空状态，并写入 deterministic `generated/reports/ssg-generation-summary.json` fallback 报告。
- `validate:dist` 增加 metadata、推荐摘要一致性、SSG 报告隐私扫描和 fallback 覆盖校验。
- Review 后补强 metadata 与当前 Pokemon name/slug 的精确校验、全量 title/description 唯一性校验、非空推荐摘要顺序校验、fallback 报告对账、OG/Twitter 绝对 URL 和空推荐重复文案。

### Review Results

- Acceptance review: 通过。确认 311 个静态页都有唯一 title/description，description 与正文摘要一致；当前数据集 311 个推荐均为空，空推荐 fallback 均记录在 SSG 报告。
- Edge-case review: 修复 metadata gate 未绑定当前 Pokemon 名称、missing recommendation fallback 与 dist gate 不闭环、SSG fallback 报告只自洽不对账、content URL 未校验和空推荐文案重复。
- Blind review: 修复 OG/Twitter URL 使用 root-relative path、title/OG/Twitter title 唯一性和当前归属校验不足、非空推荐摘要未精确校验前 3 条顺序、fallback 报告未从实际数据源对账。

### File List

- `scripts/generate-ssg.ts`
- `scripts/validate-build.ts`
- `generated/reports/ssg-generation-summary.json`
- `_bmad-output/implementation-artifacts/3-3-为静态页提供唯一-metadata-和推荐摘要.md`
