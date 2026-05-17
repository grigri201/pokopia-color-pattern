# Story 5.1: 实现 Open Design 全屏 overlay 入口与退出

Status: done

## Story

As a 用户,
I want 从当前 Pokemon 主舞台进入和退出 Open Design 全屏 overlay,
so that 我可以在不离开当前 Pokemon 页面、不改变分享链接的情况下查看沉浸式全屏展示。

## Acceptance Criteria

1. Given 用户已选中任意 Pokemon, when 用户点击主舞台顶部操作区的全屏入口, then 应用打开基于 Open Design 的全屏 overlay, and overlay 使用当前 selected Pokemon，不切换到默认 Pokemon。
2. Given 全屏 overlay 已打开, when 用户查看浏览器 URL、hash 和 history, then 当前 Pokemon canonical path/hash 不因全屏状态改变, and 全屏状态不写入分享链接。
3. Given 全屏 overlay 已打开, when 用户点击右上角 icon-only close 或按 Escape, then overlay 关闭, and 页面回到进入前的同一 Pokemon 详情页状态。
4. Given 用户通过键盘打开全屏 overlay, when overlay 完成打开, then 焦点移动到关闭图标按钮, and 退出后焦点返回全屏入口。
5. Given 浏览器 Fullscreen API 不可用、被拒绝或未调用, when 用户进入全屏模式, then 应用内 overlay 仍完整可用, and 不依赖浏览器原生 fullscreen 成功路径。
6. Given 全屏 overlay 顶部工具栏渲染, when 用户查看操作区, then 右上角显示语言切换按钮与 icon-only close，语言切换按钮位于关闭按钮左侧, and 两个控件都有可读 accessible name。

## Tasks / Subtasks

- [x] 添加全屏入口 (AC: 1)
  - [x] 入口放在现有主舞台顶部操作区，与语言切换、GitHub 链接同一层级。
  - [x] 入口使用当前 selected Pokemon，不创建第二套 Pokemon 选择状态。
- [x] 实现应用内 overlay 状态 (AC: 1, 2, 5)
  - [x] 全屏模式是 app UI state，不要求浏览器 Fullscreen API 成功。
  - [x] 打开/关闭 overlay 不修改 URL、hash、history 或 share path。
- [x] 实现 toolbar 与退出路径 (AC: 3, 6)
  - [x] 顶部 toolbar 左侧显示 `Pokopia 装饰图鉴`。
  - [x] 右侧显示语言切换按钮和 icon-only close，语言按钮在关闭按钮左侧。
  - [x] close click 和 Escape 都关闭 overlay。
- [x] 实现焦点管理 (AC: 4)
  - [x] 打开后焦点移动到关闭按钮。
  - [x] 关闭后焦点返回全屏入口。
- [x] 防回归验证 (AC: 2, 3, 4)
  - [x] 添加或更新 smoke/DOM 测试，覆盖打开、关闭、Escape、焦点返回和 URL 不变。

### Review Findings

- [x] [Review][Patch] 全屏打开时 activeElement 可能是 body，退出无法可靠回到入口 [`src/main.ts`]
- [x] [Review][Patch] 打开后的延迟 focus 可能在 overlay 已关闭后落到隐藏 close 按钮 [`src/main.ts`]
- [x] [Review][Patch] Tab 起点在 overlay 外部时可能逃出 dialog 焦点循环 [`src/main.ts`]
- [x] [Review][Patch] overlay 打开期间进入 not-found 路由会关闭隐藏 dialog 但不恢复可见焦点 [`src/main.ts`]
- [x] [Review][Patch] drawer-open 状态下触发全屏入口可能让退出焦点回到抽屉背后的控件 [`src/main.ts`]

## Dev Notes

- UI 源头是 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md` 与 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html`。
- 只实现 overlay 入口、shell、toolbar 和退出状态；不要在本故事中补齐完整信息内容或壁纸导出。
- 全屏状态必须依附当前 SPA selected Pokemon。不得先渲染默认 Ditto 再切换到 route slug。
- 不要引入 React/Vue/Next；继续使用 Vite + TypeScript + 原生 DOM。
- 用户可见字符串必须使用 DOM text API 或 HTML escape。

### Project Structure Notes

- 预期涉及：`index.html`、`src/main.ts`、`src/styles.css`，必要时可拆到 `src/app/` 下的 fullscreen 模块。
- 如果新增图标，优先复用现有图标策略或简单 icon-only button；保持 accessible name。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5 / Story 5.1]
- [Source: `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md` - 布局决策 / Open Design 标记]
- [Source: `_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html` - toolbar, overlay shell, close/language controls]
- [Source: `_bmad-output/project-context.md` - Vite/TypeScript/runtime asset rules]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-17: 开始 Story 5.1 开发，接入现有 Vite + TypeScript + 原生 DOM 入口。
- 2026-05-17: `npm run build` 通过；新增 fullscreen smoke 用例通过。
- 2026-05-17: BMAD code review 返回 5 个焦点边界 patch，已修复并复跑 build/full smoke。

### Completion Notes List

- 在主舞台顶部操作区新增 icon-only 全屏入口，并保持与语言切换、GitHub 链接同层级。
- 新增应用内 fullscreen overlay shell、toolbar、语言切换、icon-only close、Escape 关闭、背景 inert 与 Tab 焦点循环。
- 全屏状态只存在于 SPA UI state；打开/关闭不调用 Fullscreen API，不修改 URL/hash/history。
- Smoke 覆盖 Eevee 当前 selected Pokemon、原生 Fullscreen API 不可用、焦点进入/返回、Tab 循环、Escape/click 关闭和 URL/history 不变。
- Review 后补强 activeElement fallback、延迟 focus guard、overlay 外 Tab 回收、not-found 自动关闭后的焦点恢复，以及 drawer-open 入口防护。

### Review Results

BMAD code review completed: Blind Hunter 和 Edge Case Hunter 返回 5 个 patch finding，Acceptance Auditor clean；所有 patch 已修复并验证通过。

### File List

- `index.html`
- `src/main.ts`
- `src/styles.css`
- `tests/smoke/pokemon-page.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-1-实现-open-design-全屏-overlay-入口与退出.md`

### Change Log

- 2026-05-17: Created from Open Design fullscreen UI.
- 2026-05-17: Implemented fullscreen overlay entry, shell, toolbar, exit paths, focus handling, and smoke coverage.
