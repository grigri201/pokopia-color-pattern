# Story 2.5: 在 SPA 中展示推荐卡片、原因和分页

Status: ready-for-dev

## Story

As a 用户,
I want 浏览某只 Pokemon 的推荐 items、推荐原因和分页,
so that 我可以逐页判断哪些 item 适合搭配。

## Acceptance Criteria

1. Given 用户选中某只 Pokemon 且推荐 JSON 存在, when inspector 渲染推荐区域, then 每张推荐卡展示 item 名称、图像、分类、命中偏好词、是否可染色、主色和适用时的 OKLCH 和谐状态, and item 图片 alt 包含 item 名称。
2. Given 推荐结果超过 10 个, when 用户浏览推荐区域, then 每页最多展示 10 个 item, and 用户可以通过键盘可操作的分页控件前进和后退。
3. Given hydrated 体验中仍有 item 筛选能力, when 用户使用现有筛选控件, then 筛选结果与当前 Pokemon 推荐数据保持一致, and 不重新读取完整 item manifest。

## Tasks / Subtasks

- [ ] 加载当前 Pokemon 推荐 JSON (AC: 1)
  - [ ] 在选中 Pokemon 后 fetch `/data/recommendations/{slug}.json`。
  - [ ] 数据缺失或解析失败时显示可恢复推荐区域状态，不影响 Pokemon 核心详情。
- [ ] 渲染推荐卡片和原因 (AC: 1)
  - [ ] 展示 item 名称、图像、分类、matched preference terms、isDyeable、primary color、harmony status/type。
  - [ ] item 图片 alt 包含 item 名称；纯占位图使用空 alt。
  - [ ] 用户可见字符串通过 DOM text API 或 `escapeHtml`。
- [ ] 实现分页 (AC: 2)
  - [ ] 每页最多 10 个 item，数据 `pageIndex` zero-based，UI 可显示 one-based。
  - [ ] 上一页/下一页控件支持键盘、禁用态和可读标签。
- [ ] 保留现有 item 筛选能力 (AC: 3)
  - [ ] 当前 inspector 的 `itemFilter` 体验迁移到 generated recommendation data 上。
  - [ ] 不重新读取完整 `item_portraits/manifest.csv`。

## Dev Notes

- 当前 `index.html` 右侧 inspector 是 `#furnitureGrid` 和 `#itemFilter`，目前 `renderFurniture()` 只展示 4 个 heuristic slots 加 2 个 reserved slots；本故事要切换为推荐卡片和分页。
- 不要承诺“最佳推荐”；PRD 建议使用“推荐搭配”或“匹配度较高”等表达。
- 推荐 JSON 是运行时数据 API；浏览器不应重新运行推荐引擎或扫描 raw CSV。
- Hydrated 体验需要和后续 SSG 摘要共享同一 recommendation data，避免 UI 与静态页推荐不一致。
- 控件必须支持键盘操作和可读标签，移动端不得出现关键文本溢出。

### Project Structure Notes

- 预期路径：`src/data/client.ts`、`src/app/render/inspector.ts`、`src/app/render/pagination.ts`、`src/app/state.ts` 或渐进式 `src/main.ts` 修改。
- 若仍在单文件 `src/main.ts` 中实现，保持函数边界清楚，避免把推荐算法塞进渲染函数。
- CSS 在 `src/styles.css` 中延续当前视觉系统，不引入框架。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 2.5]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Recommendation Browsing, UX-DR4/UX-DR5/UX-DR6]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture, Generated Data Loading]
- [Source: `_bmad-output/project-context.md` - accessibility and runtime data rules]
- [Source: `index.html` - current inspector DOM]
- [Source: `src/main.ts` - current `renderFurniture` behavior]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
