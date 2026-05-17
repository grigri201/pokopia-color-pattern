---
project: pokopia-color-pattern
workflow: bmad-correct-course
date: 2026-05-17
status: applied-to-epics-and-stories
change_scope: moderate
mode: batch
trigger: Pokemon 页面全屏显示、偏好词强化展示、全屏壁纸生成，并要求先完成全屏 UI 设计
recommended_path: epic-5-open-design-fullscreen-ui
ui_source:
  - _bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md
  - _bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html
---

# Sprint Change Proposal - Pokemon 全屏展示与壁纸生成

## 1. Issue Summary

当前 PRD、Architecture、Epics/Stories 已完成 Epic 1-4，产品能力集中在 Pokemon 色彩详情、可解释推荐、可分享静态页和 runtime 分发边界。新的触发变更是新增用户体验能力：

1. 支持 Pokemon 页面全屏显示。
2. 在页面中更明确展示当前 Pokemon 的喜好/偏好词。
3. 在全屏模式下可以生成壁纸。
4. 进入实现前，必须先设计全屏模式下显示的 UI。

这不是 Epic 1-4 的缺陷修复。现有 Epic 1-4 已交付基础数据、推荐、SSG 和部署边界；新需求是在这些基础上增加新的展示模式与导出能力。优先推荐新增 Epic 5，而不是改写已完成 Epic 1-4。

2026-05-17 更新：用户已提供新的全屏 UI：`_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html`，并配套 `design-spec.md`。Gate 5.1a 已满足。根据该 UI，本轮 Epic 5 收敛为 Open Design 全屏展示与偏好档案基础体验；壁纸导出不在本轮实现，后续需单独确认导出比例、尺寸、文件名、预览/下载交互。

## 2. Checklist Findings

- [x] 1.1 Trigger story：无单一触发 story。触发来自新的 stakeholder requirement，发生在 Epic 1-4 全部 done 之后。
- [x] 1.2 Core problem：新需求扩展了产品体验面。现有计划只覆盖详情页、推荐解释、SSG、runtime asset boundary；不覆盖全屏沉浸展示、壁纸布局或图片导出。
- [x] 1.3 Evidence：`sprint-status.yaml` 显示 Epic 1-4 全部 done；`epics.md` 的 UX-DR 只要求三栏/三区域体验、移动端首屏、推荐卡偏好命中展示，没有独立 fullscreen/wallpaper UX；`PokemonIndexEntry` 已有 `preferenceTerms`，推荐 entry 已有 `matchedPreferenceTerms`，因此偏好词数据基础存在。
- [x] 2.1 Current epic impact：Epic 1-4 仍可按原定义成立，不需要回滚或重开完成记录。
- [x] 2.2 Epic-level changes：新增 Epic 5 最合适，主题为“Pokemon 全屏展示与壁纸生成体验”。
- [x] 2.3 Remaining planned epics：当前没有 remaining epics；新增 Epic 5 应排在 Epic 4 之后。
- [x] 2.4 New epic needed：需要。全屏 UI 与壁纸生成是独立用户价值，不应塞回 Epic 3 的分享静态页或 Epic 2 的推荐 UI。
- [x] 2.5 Priority：全屏 UI 已由 Open Design artifact 提供；已按该 UI 更新 Epics/Stories/sprint-status，PRD/Architecture 可在后续需要时同步。
- [x] 3.1 PRD impact：需要新增全屏展示、偏好词突出展示、壁纸生成、导出约束、可访问性和性能要求。
- [x] 3.2 Architecture impact：需要新增 frontend state、fullscreen mode、wallpaper renderer/export pipeline、asset reuse、validation/smoke 覆盖；不需要迁移 Vite/原生 DOM 技术栈。
- [!] 3.3 UI/UX impact：必须新增 UX Design 产物。当前没有独立 UX Design 文档，且用户明确要求先设计全屏模式 UI。
- [x] 3.4 Other artifact impact：需要后续更新 PRD、Architecture、epics.md、sprint-status.yaml，并新增 Epic 5 story files。实现阶段会影响 `index.html`、`src/main.ts`/`src/app/**`、`src/styles.css`、可能新增 wallpaper/export domain 模块、build/smoke validation。
- [x] 4.1 Direct Adjustment：可行。新增 Epic 5 + 新 stories，不改写已完成 Epic 1-4。
- [ ] 4.2 Potential Rollback：不建议。回滚已完成数据/推荐/SSG/asset boundary 不会降低新需求复杂度。
- [ ] 4.3 PRD MVP Review：不需要缩减原 MVP；这是 post-MVP 或 next-sprint 增量体验。
- [x] 4.4 Recommended path：Direct Adjustment，先 UX Design，后 correct-course 更新规划，再创建 Epic 5 stories。

## 3. Impact Analysis

### Epic Impact

Epic 1-4 保持 done，不直接改写：

- Epic 1 提供 Pokemon index、主色、色板、搜索切换和 compact data，是全屏页的数据基础。
- Epic 2 提供 preference-first 推荐和 `matchedPreferenceTerms`，是偏好词强化展示与壁纸文案的依据。
- Epic 3 提供 `/pokemon/{slug}/` 直接访问、SSG 和 hydrate parity，全屏入口应从该详情页进入，不改变 canonical route。
- Epic 4 提供 `/assets/runtime/**` 图片和 dist budget，全屏与壁纸必须复用 runtime asset boundary，不得重新引用 raw docs/source。

建议新增：

> Epic 5: Open Design 全屏展示与偏好档案基础体验
> 用户可以从 Pokemon 详情页进入 Open Design 全屏 overlay，清楚看到当前 Pokemon 的喜好/偏好词、色板和画像；本轮不实现壁纸导出。

### Story Impact

根据已提供的 Open Design 全屏 UI，Epic 5 拆成 3 个 ready-for-dev stories：

1. Story 5.1: 实现 Open Design 全屏 overlay 入口与退出
2. Story 5.2: 渲染全屏身份、色彩与偏好档案
3. Story 5.3: 验证全屏响应式、可访问性与 Open Design 样本一致性

这些 stories 不应改变 Epic 1-4 的 done 状态。`sprint-status.yaml` 已追加 `epic-5: in-progress` 和 5.1-5.3 `ready-for-dev`。壁纸导出不再作为本轮 story；只保留后续范围说明。

### Artifact Conflicts

PRD 需要新增或调整：

- Success Criteria：新增“Pokemon 全屏展示”和“可生成壁纸”的用户成功标准。
- Product Scope：把全屏模式与壁纸生成纳入新 scope，但标注为 Epic 5 增量。
- Functional Requirements：新增 FR53-FR60 一类 requirement，覆盖全屏入口、退出、偏好词展示、壁纸生成、导出反馈和错误恢复。
- NFR：新增全屏可访问性、键盘退出、移动端适配、导出性能、runtime asset boundary、无 raw source 引用要求。
- Post-Release Opportunities：如多尺寸壁纸模板、主题选择、社交分享卡片，可作为非本轮范围。

Architecture 需要新增或调整：

- Frontend Architecture：新增 fullscreen mode state、入口按钮、退出路径、focus management、route/state 是否持久化的规则。
- Data Architecture：确认全屏与壁纸只消费现有 `pokemon-index`、recommendations 和 runtime asset manifest，不创建第二套 Pokemon 数据契约。
- Wallpaper Export Architecture：定义浏览器端导出方案、输出格式、尺寸、文件命名、失败 fallback、是否需要 canvas 或 DOM snapshot。
- Validation：新增 smoke 或 DOM-level 测试，覆盖打开全屏、显示偏好词、触发壁纸生成、检查导出按钮状态和 runtime path 引用。

Epics/Stories 需要新增：

- `epics.md` 增加 Epic 5 和 story breakdown。
- `_bmad-output/implementation-artifacts/sprint-status.yaml` 增加 Epic 5 backlog。
- 后续通过 `bmad-create-story` 生成 story files，进入 dev/review loop。

UX Design 需要新增：

- 当前仓库未发现独立 UX Design 规格文档。
- 用户明确要求“先设计全屏模式下显示的 UI，再进入实现”。
- 全屏 UI 已由 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html` 和 `design-spec.md` 提供，后续 story 必须以该 UI 为准。

## 4. Recommended Approach

选择 Direct Adjustment：新增 Epic 5，并按照已提供的 Open Design 全屏 UI 整理 story。

理由：

- 新功能建立在现有数据、推荐和 runtime asset boundary 之上，技术基础已经存在。
- 全屏模式和壁纸生成是新的交互模式，不是 Epic 1-4 的验收遗漏。
- 改写 done epics 会破坏 sprint 审计语义；追加 Epic 5 能保持已完成范围稳定。
- Open Design 已明确全屏模式是应用内 overlay，入口在主舞台顶部操作区，内容包含身份、主色、色板、图案和独立偏好档案。
- Open Design 已明确本轮不实现壁纸导出；后续壁纸模板只复用全屏视觉语言，导出比例、尺寸、文件名、预览/下载交互需单独确认。

Scope classification：Moderate。需要 UX、产品文档、架构、backlog 与前端实现协同，但不需要重构核心推荐算法、SSG 架构或技术栈。

## 5. Detailed Change Proposals

### PRD - Product Scope

OLD:

```md
本 PRD 定义四个 brownfield 改造方向：精简 item manifest、构建期预计算推荐、生成 `/pokemon/{slug}/` 静态详情页、建立 runtime asset boundary。
```

NEW:

```md
本 PRD 已完成四个 brownfield 改造方向：精简 item manifest、构建期预计算推荐、生成 `/pokemon/{slug}/` 静态详情页、建立 runtime asset boundary。后续新增 Epic 5，围绕 Open Design 全屏展示、当前 Pokemon 喜好/偏好词强化展示，以及后续壁纸导出的视觉语言准备展开；本轮不实现壁纸导出。
```

Rationale：保留 Epic 1-4 历史范围，并把新能力标记为增量 Epic。

### PRD - New Functional Requirements

NEW:

```md
### Fullscreen Pokemon Presentation

- FR53: 用户可以从 Pokemon 详情页进入当前 Pokemon 的全屏展示模式。
- FR54: 用户可以从全屏展示模式明确退出，并回到同一只 Pokemon 的详情页状态。
- FR55: 全屏模式必须展示 Pokemon 名称、图像、编号、主色、色板和当前 Pokemon 的喜好/偏好词。
- FR56: 普通详情页也必须比当前实现更明确地展示当前 Pokemon 的喜好/偏好词，而不只在推荐卡片中展示命中词。
- FR57: 全屏模式必须保留推荐摘要或精选推荐入口，但不要求完整推荐分页占据主视觉。
- FR58: 用户可以通过右上角关闭图标或 Escape 退出全屏模式，且焦点返回全屏入口。
- FR59: 全屏状态不写入 URL、hash、分享链接或浏览器历史记录。
- FR60: 壁纸导出不属于本轮 Epic 5；后续壁纸模板必须复用全屏视觉语言，并在导出比例、尺寸、文件名、预览/下载交互确认后再实现。
```

Rationale：新增能力需要独立验收，不应只用“优化 UI”描述。

### PRD - New Non-Functional Requirements

NEW:

```md
- NFR35: 全屏入口、退出和语言切换控件必须支持键盘操作，并有可读 accessible name。
- NFR36: 全屏模式必须在桌面和移动视口下保持内容不重叠、不溢出；移动端使用 Open Design 确认的纵向滚动布局。
- NFR37: 全屏模式不得引用 `/docs/pokopia_image_sources/**`，必须使用 `/assets/runtime/**` 或已验证 runtime data。
- NFR38: 全屏核心体验不得依赖浏览器 Fullscreen API 是否可用或是否被允许。
- NFR39: 本轮不得暴露未实现的壁纸导出按钮、假下载能力或会误导用户的导出承诺。
```

Rationale：全屏和导出涉及可访问性、响应式、asset boundary 和隐私边界。

### Architecture - Fullscreen State

NEW:

```md
### Fullscreen Presentation Architecture

- Fullscreen mode is a frontend UI state derived from the selected Pokemon slug.
- The selected Pokemon remains the canonical state; fullscreen must not create a second Pokemon selection model.
- Entering fullscreen may use a dedicated overlay/view and may optionally request the browser Fullscreen API after UX approval, but core layout must still work when the API is unavailable or denied.
- Exiting fullscreen returns to the same selected Pokemon and preserves recommendation/filter state where practical.
- Focus moves into fullscreen controls on entry and returns to the triggering control on exit.
```

Rationale：避免把全屏实现绑定到浏览器 Fullscreen API 的成功路径，也避免重复 state。

### Architecture - Wallpaper Export Deferral

NEW:

```md
### Wallpaper Export Deferral

- Epic 5 does not implement wallpaper export.
- Future wallpaper generation must reuse the Open Design fullscreen visual language.
- Output format, aspect ratio, dimensions, filename convention, preview and download interactions are not settled by the current UI and must be confirmed before implementation.
- The Epic 5 UI must not expose a fake or disabled wallpaper export promise as if it were implemented.
```

Rationale：Open Design 已明确本轮先完成全屏布局承载结构，不实现导出。

### Epics - Add Epic 5

NEW:

```md
### Epic 5: Open Design 全屏展示与偏好档案基础体验

用户可以从当前 Pokemon 详情页进入基于 Open Design 的应用内全屏 overlay，沉浸式查看 Pokemon 图像、身份信息、主色/色板/图案和独立偏好档案，并在桌面、窄屏和移动端保持可读、可退出、可键盘操作。

**FRs covered:** FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60

**Implementation notes:** 该 Epic 以 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md` 与 `index.html` 为 UI 源头。全屏模式不替换现有三栏/抽屉浏览体验，只作为当前 selected Pokemon 的 overlay。入口位于现有主舞台顶部操作区；退出通过右上角 icon-only close 与 Escape；焦点进入后落到关闭按钮，退出后回到入口。全屏状态不写入 URL、hash、分享链接或 history。本轮不实现壁纸导出；后续壁纸模板必须单独确认导出比例、尺寸、文件名、预览/下载交互。
```

### Sprint Status - Add Backlog Entries After Approval

NEW:

```yaml
  epic-5: in-progress
  5-1-实现-open-design-全屏-overlay-入口与退出: ready-for-dev
  5-2-渲染全屏身份色彩与偏好档案: ready-for-dev
  5-3-验证全屏响应式可访问性与样本一致性: ready-for-dev
  epic-5-retrospective: optional
```

Rationale：只追加 Epic 5，不重开 Epic 1-4；story files 已基于 Open Design UI 创建，因此状态为 ready-for-dev。

## 6. UX Design Source Applied

已应用的 UI 来源：

- `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md`
- `_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html`

关键设计结论：

- 全屏入口放在现有主舞台顶部操作区。
- 全屏模式是应用内 overlay，不依赖浏览器 Fullscreen API。
- 全屏内容包括 Pokemon 图像、名称、编号、slug、HEX/RGB/CMYK、完整色板、图案和偏好词。
- 偏好词作为独立 `偏好档案` 模块展示；为空时显示可读空状态。
- 桌面为左信息、右画像卡片；中窄屏和移动端改为纵向滚动。
- 退出路径包括右上角关闭图标按钮和 Escape；焦点进入全屏后移动到关闭按钮，退出后回到全屏入口。
- URL 与当前 Pokemon 选择保持不变；全屏状态不写入分享链接。
- 本轮先完成全屏布局承载结构，不实现壁纸导出；后续壁纸模板需单独确认导出比例、尺寸、文件名、预览和下载交互。

## 7. Implementation Handoff

Recommended handoff sequence:

1. `bmad-dev-story`：执行 Story 5.1。
2. `bmad-code-review`：review Story 5.1，并修复发现的问题。
3. `bmad-dev-story`：执行 Story 5.2。
4. `bmad-code-review`：review Story 5.2，并修复发现的问题。
5. `bmad-dev-story`：执行 Story 5.3。
6. `bmad-code-review`：review Story 5.3，并修复发现的问题。
7. 运行 build/smoke/全屏样本验证。

Handoff responsibilities:

- Developer：实现 Story 5.1-5.3，并保持 Epic 1-4 数据、推荐、SSG、runtime asset boundary 不回退。
- Reviewer：逐 story 检查 Open Design 一致性、焦点/键盘、响应式、runtime path 和未实现壁纸导出不被误暴露。
- PM/Architect：壁纸导出若要进入实现，应另行确认模板和 acceptance criteria。

## 8. Applied Decision

- 新增 Epic 5，不改写已完成 Epic 1-4。
- 使用已提供的 Open Design 全屏 UI 整理 Epic 5 和 Story 5.1-5.3。
- 本轮不实现壁纸导出；后续导出模板需单独 correct-course 或 UX/story 更新。
