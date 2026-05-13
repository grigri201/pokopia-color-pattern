# Story 1.4: 保留 Pokemon 搜索、切换与色板阅读体验

Status: ready-for-dev

## Story

As a 用户,
I want 在 generated data 驱动下继续搜索、切换和查看 Pokemon 色板,
so that 现有色彩浏览体验不会因为数据管线改造而退化。

## Acceptance Criteria

1. Given Pokemon index 数据已加载, when 用户搜索 Pokemon 名称、英文名或编号, then 列表过滤结果正确更新, and 用户可以选择结果进入对应详情。
2. Given 用户选中某只 Pokemon, when 详情区域渲染, then 页面展示 Pokemon 名称、英文名、图像、编号、主色、色板和文本色值, and Pokemon 图片 alt 包含 Pokemon 名称。
3. Given 用户使用键盘浏览搜索、范围过滤和 Pokemon 列表, when 焦点移动或控件被触发, then 控件有可读标签且可键盘操作, and 移动端窄屏不出现关键文本溢出或不可点击状态。

## Tasks / Subtasks

- [ ] 保留搜索与范围过滤行为 (AC: 1)
  - [ ] 确认 generated `pokemon-index.json` 包含搜索所需的 sequence、name、zhName、slug。
  - [ ] 迁移后继续支持名称、英文名、编号过滤。
  - [ ] 选中列表项后继续关闭抽屉并渲染对应 Pokemon。
- [ ] 渲染 generated 色彩数据 (AC: 2)
  - [ ] 详情区使用生成的 primaryColor 和 palette，不再依赖 runtime canvas 作为主路径。
  - [ ] 色板显示 HEX/RGB 或等价文本色值，不只显示色块。
  - [ ] Pokemon 图片 alt 包含中文名和英文名。
- [ ] 可访问性与移动端回归检查 (AC: 3)
  - [ ] 搜索框、范围按钮、Pokemon 列表项、抽屉打开/关闭控件保持键盘可用。
  - [ ] 移动端检查标题、色值、按钮和图片不溢出。
  - [ ] 图片或占位图遵守 alt 策略。
- [ ] 回归验证 (AC: 1, 2, 3)
  - [ ] 至少验证默认 Ditto、一个 early range Pokemon、一个 late range Pokemon。
  - [ ] 运行 `npm run build`，涉及 UI 时使用本地 dev/preview 做手动或浏览器 smoke 检查。

## Dev Notes

- 当前 `index.html` 和 `src/styles.css` 已定义三栏/三区域体验：Pokemon 搜索抽屉、中央 Pokemon 色板舞台、右侧搭配道具 inspector。本故事要保留该结构。
- 当前 `renderList()` 通过 `innerHTML` 生成列表，已有 `escapeHtml`。继续保证所有 manifest/generated 字段经过转义或 DOM text API。
- 当前 `selectPokemon()` 选择 unknown slug 时 fallback 到第一个 Pokemon；后续 Epic 3 会引入 not-found route 状态，本故事不要提前改变 canonical route 语义，除非为保持 UX 必须做局部防护。
- 当前 runtime palette extraction 可作为临时 fallback，但 primary path 应是 generated palette。
- 保留当前 `#slug` 行为，canonical `/pokemon/{slug}/` 由 Epic 3 处理。

### Project Structure Notes

- 预期触达：`src/main.ts` 或拆分后的 `src/app/render/drawer.ts`、`src/app/render/stage.ts`、`src/utils/escape-html.ts`。
- CSS 继续使用 `src/styles.css` 全局样式和自定义属性，不引入组件框架。
- 不要在本故事引入高级推荐分页 UI；那属于 Epic 2。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` - UX-DR1/UX-DR2/UX-DR3/UX-DR5/UX-DR6]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture]
- [Source: `_bmad-output/project-context.md` - Code Quality & Style Rules]
- [Source: `index.html` - current three-zone DOM structure]
- [Source: `src/main.ts` - current search/select/render behavior]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
