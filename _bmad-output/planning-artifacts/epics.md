---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
  - step-correct-course-runtime-boundary
  - step-correct-course-fullscreen-ui-epic5
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md
  - _bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17.md
workflowType: 'epics'
project_name: 'pokopia-color-pattern'
user_name: 'Grigri'
date: '2026-05-17'
status: 'complete'
lastStep: 4
completedAt: '2026-05-13'
lastEdited: '2026-05-17'
changeHistory:
  - date: '2026-05-17'
    changes: 'Added Epic 5 and story breakdown from Open Design fullscreen UI; wallpaper export deferred pending separate template decisions.'
---

# pokopia-color-pattern - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pokopia-color-pattern, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 用户可以直接访问某只 Pokemon 的稳定详情页。

FR2: 用户可以在 Pokemon 详情页看到 Pokemon 名称、英文名、图像和编号。

FR3: 用户可以在 Pokemon 详情页看到该 Pokemon 的主色和色板。

FR4: 用户可以从某只 Pokemon 详情页继续切换到其他 Pokemon。

FR5: 用户可以搜索 Pokemon 并进入对应详情内容。

FR6: 用户可以在无脚本或脚本尚未加载完成时读取 Pokemon 详情页核心内容。

FR7: 系统可以为每只 Pokemon 提供主色数据。

FR8: 系统可以为每只 Pokemon 提供多色色板数据。

FR9: 系统可以为每个参与推荐的 item 提供主色数据。

FR10: 用户可以查看色板颜色值，以便理解搭配依据。

FR11: 系统可以将颜色关系归类为可用于搭配判断的和谐关系。

FR12: 系统可以基于 Pokemon 偏好词筛选候选 items。

FR13: 系统可以识别 item 是否可染色。

FR14: 系统可以让可染色 item 在命中偏好词后进入推荐候选，而不要求主色和谐。

FR15: 系统可以让不可染色 item 在命中偏好词后继续接受色彩和谐判断。

FR16: 系统可以排除未命中 Pokemon 偏好词的 item。

FR17: 系统可以为每只 Pokemon 生成推荐 item 列表。

FR18: 系统可以为每个推荐 item 提供推荐原因。

FR19: 用户可以区分推荐 item 是因为偏好词、可染色状态还是色彩和谐进入结果。

FR20: 系统可以在推荐结果为空，或自动推荐少于 3 个 item 时，提供可恢复的空状态或 fallback 推荐状态。

FR21: 用户可以浏览某只 Pokemon 的推荐 items。

FR22: 用户可以按每页 10 个 item 查看推荐结果。

FR23: 用户可以在推荐结果页之间前进和后退。

FR24: 用户可以在推荐 item 卡片中看到 item 名称、图像、分类、命中偏好词、是否可染色、主色和适用时的 OKLCH 和谐状态。

FR25: 用户可以在 hydrated 体验中继续使用现有 item 筛选能力。

FR26: 用户可以分享某只 Pokemon 的稳定详情页 URL。

FR27: 被分享的详情页可以在直接访问时展示该 Pokemon 的核心内容。

FR28: 系统可以为每只 Pokemon 详情页提供页面级标题和描述内容。

FR29: 系统可以为每只 Pokemon 详情页提供推荐摘要内容。

FR30: 系统可以在详情页加载完成后保留 SPA 的搜索、切换、筛选和分页能力。

FR31: 系统可以提供精简 item 数据契约，只包含前端运行时和推荐展示所需字段。

FR32: 系统必须保留原始 Pokopia 数据源不修改，并将其作为只读输入。

FR33: 系统可以在每次编译时从原始数据源生成 compact item 数据。

FR34: 系统可以生成每只 Pokemon 的推荐数据。

FR35: 系统可以生成每只 Pokemon 的静态详情页内容。

FR36: 系统可以为推荐数据保留解释字段，以支持 UI 展示和排查。

FR37: 维护者可以重新生成 compact item 数据、推荐数据和静态详情页。

FR38: 维护者可以通过 Pokemon metadata override 脚本覆盖 Pokemon 主色、色板和 pattern。

FR39: 维护者可以通过 Pokemon metadata override 脚本追加某只 Pokemon 的搭配道具。

FR40: 维护者可以通过 Pokemon metadata override 脚本直接覆盖某只 Pokemon 的搭配道具列表。

FR41: 维护者可以验证 compact item 数据符合定义的 schema。

FR42: 维护者可以验证 Pokemon metadata override 数据符合定义的 schema。

FR43: 维护者可以验证每只 Pokemon 都有推荐数据产物。

FR44: 维护者可以验证每只 Pokemon 都有静态详情页产物。

FR45: 维护者可以用固定样本验证推荐规则覆盖偏好词、可染色 item 和不可染色 item。

FR46: 维护者可以用固定样本验证 override 的搭配道具追加与直接覆盖行为。

FR47: 维护者可以排查推荐结果中使用的偏好词、可染色状态、主色和和谐判定。

FR48: 系统可以在输入数据缺失、图片取色失败或 slug 不存在时提供明确恢复路径。

FR49: 系统可以从 raw image source allowlist 生成运行时图片资产，而不是直接分发完整 raw source 图片目录。

FR50: 系统可以生成 runtime asset manifest，将 Pokemon 和推荐 item 的源图片映射到 `/assets/runtime/**` 分发路径。

FR51: 系统可以在 production build 中排除 `docs/pokopia_image_sources/**` raw source、raw CSV/JSON manifest 和 build-only diagnostics。

FR52: 维护者可以验证 `dist` 总体积、runtime image 体积、runtime data 体积、raw source exclusion 和静态页资源引用。

FR53: 用户可以从当前 Pokemon 详情页进入应用内全屏 overlay。

FR54: 全屏模式必须基于当前 selected Pokemon，不改变 URL、hash 或分享链接状态。

FR55: 全屏模式可以展示 Pokemon 图像、名称、编号和 slug。

FR56: 全屏模式可以展示当前 Pokemon 的主色数值、完整色板和由色板生成的图案。

FR57: 全屏模式可以用独立 `偏好档案` 模块展示当前 Pokemon 的喜好/偏好词；偏好词为空时也必须显示可读空状态。

FR58: 用户可以通过右上角关闭图标按钮或 Escape 退出全屏模式，并回到进入前的 Pokemon 详情页。

FR59: 用户可以在全屏模式中继续切换界面语言，语言切换控件位于关闭按钮左侧。

FR60: 壁纸导出不属于本轮 Epic 5 实现范围；后续壁纸模板必须复用全屏视觉语言，并在导出比例、尺寸、文件名、预览和下载交互确认后再进入实现。

### NonFunctional Requirements

NFR1: 完整 `item_portraits/manifest.csv` 不得作为首屏运行时必需资源加载，也不得随 raw source 目录复制到 `dist`。

NFR2: compact runtime item data gzip 后必须小于 50KB；build-only traceability data 可以保留在 `generated/**`，但不得进入 runtime payload。

NFR3: 单个 Pokemon 推荐数据 gzip 后必须小于 5KB，且 `dist/data/recommendations/**` raw 总体积小于 12 MiB、gzip 总体积小于 800 KiB。

NFR4: `/pokemon/{slug}/` 静态页首屏核心内容不得依赖客户端推荐计算完成后才出现。

NFR5: 构建流程必须校验 `dist` total size、runtime image size、runtime data size、raw source exclusion 和 SSG 页面存在性，防止 payload 回归。

NFR6: 页面目标满足基础 WCAG 2.2 AA。

NFR7: 色板必须提供文本色值，不得只依赖颜色块传达信息。

NFR8: 搜索、筛选、分页和推荐浏览控件必须支持键盘操作。

NFR9: Pokemon 图片 alt 必须包含 Pokemon 名称；推荐 item 图片 alt 必须包含 item 名称；纯装饰图或占位图必须使用空 alt，并可用边框加透明百变怪剪影作为视觉占位。

NFR10: 全部 311 个 Pokemon 必须生成可直接访问的 `/pokemon/{slug}/` 静态页面。

NFR11: 每个静态页面必须包含唯一 title、description 和可读正文摘要。

NFR12: 静态页面在无 JS 时必须保留 Pokemon 名称、图片、主色、色板和推荐摘要。

NFR13: hydrate 后页面展示的 Pokemon 与直接访问路径中的 slug 必须一致。

NFR14: 同一输入 manifest、图片和算法版本必须生成相同推荐排序。

NFR15: 可染色 item 不得因主色不和谐被过滤。

NFR16: 不可染色 item 必须同时满足偏好词命中和 OKLCH 和谐判定。

NFR17: 推荐解释契约必须能通过 recommendation entry 或 validated runtime lookup 复现 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`；entry 本身至少保留 `itemSlug`、`matchedPreferenceTerms`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`。

NFR18: 图片取色失败时必须优先使用 Pokemon metadata override；没有 override 时使用默认中性色和空色板，并在生成结果中记录 `colorSource: fallback`。

NFR19: compact item manifest 必须有 schema 或等价结构校验。

NFR20: Pokemon metadata override 必须有 schema 或等价结构校验。

NFR21: 编译流程必须从原始数据源和 override 数据重新生成 compact data、推荐数据、runtime asset manifest/assets 和 SSG 页面。

NFR22: 推荐引擎必须有 fixture-based tests 覆盖偏好词、可染色、不可染色和 OKLCH 分支。

NFR23: 推荐引擎必须有 fixture-based tests 覆盖搭配道具 override 的追加和直接覆盖模式。

NFR24: SSG 输出必须有构建断言验证全部 311 个 `/pokemon/{slug}/` 页面存在，并抽样验证 `ditto` 等固定 fixture 页包含标题、图片、主色、色板和推荐摘要。

NFR25: 浏览器 smoke test 必须覆盖一个直接访问静态页并 hydrate 的路径。

NFR26: production build command 必须在生成 compact data、推荐数据和 SSG 页面后成功完成。

NFR27: 本项目不得引入用户账号、支付信息或敏感个人数据收集作为本 PRD 范围。

NFR28: 构建脚本不得要求将外部服务密钥写入前端产物。

NFR29: 静态页面和数据文件不得暴露本地绝对路径或开发机私有信息。

NFR30: `dist` uncompressed logical size 必须小于 40 MiB；`dist/docs/pokopia_image_sources/**` 必须不存在。

NFR31: runtime image assets 必须由构建脚本从 raw image source allowlist 生成，默认输出 WebP 或等价压缩格式，并保留必要 alt/metadata 映射。

NFR32: runtime image assets 总体积必须小于 15 MiB；单个 Pokemon runtime image 小于 64 KiB，单个 item runtime image 小于 32 KiB。

NFR33: production build command 必须在生成 runtime image assets、删除或跳过 raw docs copy、完成 size budget 校验后成功完成。

NFR34: 静态 HTML、runtime JSON 和 browser bundle 不得引用 `/docs/pokopia_image_sources/**` 作为生产图片路径；生产图片引用必须指向 `/assets/runtime/**` 或等价 runtime allowlist 路径。

NFR35: 全屏模式必须作为应用内 overlay 工作；核心体验不得依赖浏览器 Fullscreen API 是否可用或是否被允许。

NFR36: 全屏入口、关闭按钮、Escape 退出和语言切换必须支持键盘操作，并有可读 accessible name。

NFR37: 进入全屏后焦点移动到关闭图标按钮；退出后焦点返回触发全屏入口。

NFR38: 全屏模式在桌面、中窄屏和移动视口下不得出现关键内容重叠、横向溢出或不可点击状态。

NFR39: 全屏模式、全屏图片和验证测试不得引用 `/docs/pokopia_image_sources/**`；生产路径必须继续使用 `/assets/runtime/**` 或 validated runtime lookup。

NFR40: 全屏 UI 的实现必须保留或等价映射 Open Design 标记：`fullscreen-layout`、`fullscreen-toolbar`、`fullscreen-content`、`fullscreen-info`、`fullscreen-identity`、`fullscreen-color-stack`、`fullscreen-preferences`、`fullscreen-palette`、`fullscreen-pattern`、`fullscreen-pokemon-card`。

NFR41: 全屏验证必须覆盖 Open Design 指定样本：`No.180 利欧路`、`Ditto` 和 `Pikachu`。

### Additional Requirements

- 使用现有 brownfield Vite + TypeScript + 原生 DOM 项目作为 starter；不重新脚手架，不迁移 React/Vue/Next/Remix/Astro。
- Story 1 应先建立 generation/test/build infrastructure，再改变可见 SPA 行为。
- 构建脚本运行在 Node ESM 中，可使用 Node 内置模块；浏览器端不得依赖 Node-only API。
- `docs/pokopia_image_sources/**` 是只读 raw data boundary；生成数据不得写回 raw docs/source 目录。
- `docs/oklch_color.ts` 是 OKLCH 方法论源头，推荐引擎只能复用或薄封装，不能另写 RGB/HSL/距离近似规则。
- `docs/pokopia_image_sources/item_portraits/manifest.csv` 是完整 1,219 个 in-collection item 的重数据源，不得进入首屏运行时关键路径。
- `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 包含 311 个 Pokemon portrait，是 SSG 页面范围来源。
- source/generated/runtime 边界：raw source 在 `docs/pokopia_image_sources/**`，维护者 override 在 `data/overrides/**`，本地生成数据在 `generated/data/**`，最终分发数据在 `dist/data/**` 与 `dist/assets/runtime/**`。
- `docs/pokopia_image_sources/**` 不得复制到 `dist`；production 只能分发 allowlist runtime data、runtime image assets、app bundle 和 SSG HTML。
- 建议生成数据包括 `generated/data/pokemon-index.json`、`generated/data/compact-items.json`、`generated/data/recommendations/{slug}.json` 和 `generated/data/build-summary.json`。
- runtime image assets 输出到 `/assets/runtime/pokemon/{slug}.webp` 与 `/assets/runtime/items/{slug}.webp`，并由 asset manifest 记录映射与体积。
- JSON 数据契约使用 camelCase 字段、`schemaVersion` 顶层字段、稳定排序和稳定字段顺序。
- 推荐文件必须包含 `pageSize: 10`、`totalPages`，且 `pageIndex` 在数据中为 zero-based。
- 推荐排序必须 deterministic：override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit、稳定 item slug tie-breaker。
- Pokemon color fallback 优先级为 metadata override、portrait 提取主色、默认中性色和空色板，并记录 `colorSource: "fallback"`。
- item color fallback 必须记录 fallback，不得静默伪装成提取成功。
- canonical route 是 `/pokemon/{slug}/`，legacy/current route 是 `/#slug`；hydrate 优先 pathname slug，其次 hash，最后默认 `ditto`。
- SSG 应在 Vite build 后读取 `dist/index.html`、generated Pokemon data 和 recommendation data，为全部 311 个 Pokemon 写入 `dist/pokemon/{slug}/index.html`。
- 静态页资源 URL 使用 root-absolute path，避免嵌套路由下 CSS/JS/image/JSON 相对路径失效。
- Hydrated app 不得先渲染默认 Ditto 再跳转到 route slug。
- 浏览器运行时通过 `/data/pokemon-index.json`、`/data/compact-items.json` 和 `/data/recommendations/{slug}.json` 获取静态 JSON；不定义后端 API。
- 浏览器和 SSG 生产图片路径必须通过 runtime asset boundary 解析，不得直接引用 `/docs/pokopia_image_sources/**`。
- 前端拆分建议：`src/app/` 管理 boot/events/router/state/render，`src/data/` 管理 client/schemas/types，`src/domain/` 管理 pure business logic，`scripts/` 管理 Node-only generation/validation。
- 建议新增轻量验证依赖：Vitest 覆盖 unit/fixture tests，Playwright 覆盖直接访问静态页并 hydrate 的 smoke test。
- `npm run build` 应成为 production gate：生成数据、runtime assets、测试、typecheck、Vite build、SSG generation、build validation，并在可用时运行浏览器 smoke。
- 所有 user-visible HTML 字符串必须经过 `escapeHtml` 或 DOM text API；manifest 字段不得直接插入 `innerHTML`。
- 生成产物不得包含当前时间、随机数、本机绝对路径、开发机用户名、外部服务密钥或私有环境值。
- 构建错误应聚合并打印可操作的文件/路径细节，浏览器数据加载失败应显示可恢复 UI，而不是让页面空白。

### UX Design Requirements

未发现独立 UX Design 规格文档。本次 story 拆分仍需继承 PRD 和 Architecture 中已定义的 UX/可访问性要求：

UX-DR1: 保留当前三栏/三区域体验结构：左侧 Pokemon 搜索抽屉、中央 Pokemon 色板舞台、右侧搭配道具 inspector。

UX-DR2: 移动端首屏优先展示 Pokemon 名称、图片、主色和推荐摘要。

UX-DR3: 色板必须提供文本色值，不只依赖色块视觉。

UX-DR4: 推荐 item 卡片必须展示 item 名称、图像、分类、命中偏好词、是否可染色、主色和适用时的 OKLCH 和谐状态。

UX-DR5: 搜索、筛选、分页和推荐浏览控件必须支持键盘操作和可读标签。

UX-DR6: Pokemon 图片 alt 包含 Pokemon 名称；推荐 item 图片 alt 包含 item 名称；纯装饰或占位图使用空 alt。

UX-DR7: 推荐结果为空或少于 3 个 item 时，界面必须提供可恢复的空状态或 fallback 推荐状态。

UX-DR8: hydrate 前静态页核心内容可读，hydrate 后搜索、切换、筛选和分页体验保持连续，不出现默认 Pokemon 闪烁后跳转。

UX-DR9: 全屏入口位于现有主舞台顶部操作区，与语言切换、GitHub 链接同一层级。

UX-DR10: 全屏模式是应用内 overlay，不替换现有三栏/抽屉浏览布局。

UX-DR11: 全屏 overlay 顶部工具栏左侧显示 `Pokopia 装饰图鉴` 品牌文本，右侧显示语言切换按钮和 icon-only 关闭按钮。

UX-DR12: 桌面全屏主体为左右结构：左侧信息区，右侧 Pokemon 画像卡片。

UX-DR13: 左侧信息区上方展示名称、编号和 slug；下方左侧展示 HEX/RGB/CMYK、色板和图案；下方右侧展示纵向 `偏好档案`。

UX-DR14: `偏好档案` 模块独立展示偏好词；偏好词为空时显示可读空状态，不隐藏模块。

UX-DR15: Pokemon 画像卡片使用当前 runtime Pokemon 图像，带有大型编号 figcaption、框线、透明背景和 drop-shadow 的 Open Design 视觉语言。

UX-DR16: 中窄屏与移动端全屏模式改为纵向滚动：信息区在上，Pokemon 画像卡片在下；信息区内部依次显示身份、主色/色板、偏好。

UX-DR17: 全屏退出路径包括右上角关闭图标按钮和 Escape；进入/退出必须保持焦点管理。

UX-DR18: 全屏状态不写入 URL、hash、分享链接或浏览器历史记录。

UX-DR19: 本轮全屏 UI 不实现壁纸导出；后续壁纸模板复用全屏视觉语言，但导出比例、尺寸、文件名、预览/下载交互需要单独确认。

### FR Coverage Map

FR1: Epic 3 - 可分享、可直接访问的静态 Pokemon 页面。

FR2: Epic 1 - Pokemon 详情展示名称、英文名、图像和编号。

FR3: Epic 1 - Pokemon 详情展示主色和色板。

FR4: Epic 1 - 从当前 Pokemon 切换到其他 Pokemon。

FR5: Epic 1 - 搜索 Pokemon 并进入对应详情。

FR6: Epic 3 - 无脚本或脚本尚未加载完成时读取静态详情页核心内容。

FR7: Epic 1 - 为每只 Pokemon 提供主色数据。

FR8: Epic 1 - 为每只 Pokemon 提供多色色板数据。

FR9: Epic 1 - 为参与推荐的 item 提供主色数据。

FR10: Epic 1 - 展示色板颜色值。

FR11: Epic 1 - 将颜色关系归类为可用于搭配判断的和谐关系。

FR12: Epic 2 - 基于 Pokemon 偏好词筛选候选 items。

FR13: Epic 2 - 识别 item 是否可染色。

FR14: Epic 2 - 可染色 item 命中偏好词后不要求主色和谐。

FR15: Epic 2 - 不可染色 item 命中偏好词后继续接受色彩和谐判断。

FR16: Epic 2 - 排除未命中 Pokemon 偏好词的 item。

FR17: Epic 2 - 为每只 Pokemon 生成推荐 item 列表。

FR18: Epic 2 - 为每个推荐 item 提供推荐原因。

FR19: Epic 2 - 用户可区分偏好词、可染色状态和色彩和谐推荐原因。

FR20: Epic 2 - 推荐为空或少于 3 个时提供可恢复空状态或 fallback。

FR21: Epic 2 - 浏览某只 Pokemon 的推荐 items。

FR22: Epic 2 - 每页 10 个 item 查看推荐结果。

FR23: Epic 2 - 推荐结果页之间前进和后退。

FR24: Epic 2 - 推荐 item 卡片展示名称、图像、分类、命中偏好词、可染色、主色和 OKLCH 状态。

FR25: Epic 2 - hydrated 体验继续使用现有 item 筛选能力。

FR26: Epic 3 - 分享某只 Pokemon 的稳定详情页 URL。

FR27: Epic 3 - 被分享详情页直接访问时展示核心内容。

FR28: Epic 3 - 每只 Pokemon 详情页提供页面级标题和描述。

FR29: Epic 3 - 每只 Pokemon 详情页提供推荐摘要。

FR30: Epic 3 - 详情页加载完成后保留 SPA 搜索、切换、筛选和分页能力。

FR31: Epic 1 - 提供精简 item 数据契约。

FR32: Epic 1 - 保留原始 Pokopia 数据源不修改并作为只读输入。

FR33: Epic 1 - 每次编译从原始数据源生成 compact item 数据。

FR34: Epic 2 - 生成每只 Pokemon 的推荐数据。

FR35: Epic 3 - 生成每只 Pokemon 的静态详情页内容。

FR36: Epic 2 - 推荐数据保留解释字段。

FR37: Epic 1 - 维护者可重新生成 compact item 数据、推荐数据和静态详情页。

FR38: Epic 2 - 通过 Pokemon metadata override 覆盖主色、色板和 pattern。

FR39: Epic 2 - 通过 Pokemon metadata override 追加搭配道具。

FR40: Epic 2 - 通过 Pokemon metadata override 直接覆盖搭配道具列表。

FR41: Epic 1 - 验证 compact item 数据 schema。

FR42: Epic 1 - 验证 Pokemon metadata override schema。

FR43: Epic 3 - 验证每只 Pokemon 都有推荐数据产物。

FR44: Epic 3 - 验证每只 Pokemon 都有静态详情页产物。

FR45: Epic 2 - 用固定样本验证偏好词、可染色和不可染色推荐规则。

FR46: Epic 2 - 用固定样本验证 override 追加与直接覆盖行为。

FR47: Epic 2 - 排查推荐结果中使用的偏好词、可染色状态、主色和和谐判定。

FR48: Epic 3 - 输入数据缺失、图片取色失败或 slug 不存在时提供明确恢复路径。

FR49: Epic 4 - 从 raw image source allowlist 生成 runtime 图片资产。

FR50: Epic 4 - 生成 runtime asset manifest 映射源图片和 `/assets/runtime/**` 分发路径。

FR51: Epic 4 - production build 排除 raw source、raw manifest 和 build-only diagnostics。

FR52: Epic 4 - 验证 `dist` 总体积、runtime image/data 体积、raw source exclusion 和静态页资源引用。

FR53: Epic 5 - 从当前 Pokemon 详情页进入应用内全屏 overlay。

FR54: Epic 5 - 全屏模式基于当前 selected Pokemon，且不改变 URL/hash/share 状态。

FR55: Epic 5 - 全屏模式展示 Pokemon 图像、名称、编号和 slug。

FR56: Epic 5 - 全屏模式展示主色数值、完整色板和色板图案。

FR57: Epic 5 - 全屏模式用独立 `偏好档案` 展示偏好词，并处理空偏好词状态。

FR58: Epic 5 - 通过关闭按钮和 Escape 退出全屏，并回到进入前详情页。

FR59: Epic 5 - 全屏工具栏提供语言切换入口。

FR60: Epic 5 - 壁纸导出后续单独确认，本轮只保留视觉语言和范围边界。

## Epic List

### Epic 1: 快速、可靠的 Pokemon 色彩详情体验

用户可以在现有 SPA 中浏览 Pokemon 名称、图片、主色、色板和搜索切换能力，同时运行时不再依赖完整重 manifest。

**FRs covered:** FR2, FR3, FR4, FR5, FR7, FR8, FR9, FR10, FR11, FR31, FR32, FR33, FR37, FR41, FR42

**Implementation notes:** 该 Epic 建立 compact item data、Pokemon/item 色彩数据、schema 和生成入口，是后续推荐和 SSG 的数据基础，但自身也交付更快、更可靠的 Pokemon 色彩详情体验。

### Epic 2: 可解释的 Pokemon 物品推荐体验

用户可以看到基于偏好词、可染色状态和 OKLCH 和谐规则生成的推荐 item，并分页浏览、理解推荐原因；维护者可以用 override 和 fixtures 验证推荐。

**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR34, FR36, FR38, FR39, FR40, FR45, FR46, FR47

**Implementation notes:** 该 Epic 在 Epic 1 的数据契约上增加推荐引擎、推荐数据、override 模式、推荐 UI 和 fixture tests。推荐规则必须保持偏好词优先、可染色豁免色彩和谐、不可染色要求 OKLCH 和谐。

### Epic 3: 可分享、可直接访问的静态 Pokemon 页面

用户可以访问和分享 `/pokemon/{slug}/`，无 JS 时仍能看到核心内容，hydrate 后保持同一 Pokemon、同一推荐和 SPA 交互。

**FRs covered:** FR1, FR6, FR26, FR27, FR28, FR29, FR30, FR35, FR43, FR44, FR48

**Implementation notes:** 该 Epic 在 Epic 1/2 的生成数据和推荐数据上增加 SSG、路径解析、静态 HTML 内容、hydrate parity、直接访问 smoke test 和完整输出断言。

### Epic 4: Runtime 分发体积与部署边界

维护者可以部署只包含 runtime-required optimized assets/data 的 `dist`，避免把完整 raw Pokopia source data、重复图片目录和 build-only diagnostics 发布出去。

**FRs covered:** FR49, FR50, FR51, FR52

**Implementation notes:** 该 Epic 是 2026-05-14 correct-course 后新增的 release hardening。它不改变现有 UX 和 SSG 目标，而是把图片路径、runtime data contract、Vite copy behavior 和 `validate:dist` budget 收紧为部署可接受的边界。

### Epic 5: Open Design 全屏展示与偏好档案基础体验

用户可以从当前 Pokemon 详情页进入基于 Open Design 的应用内全屏 overlay，沉浸式查看 Pokemon 图像、身份信息、主色/色板/图案和独立偏好档案，并在桌面、窄屏和移动端保持可读、可退出、可键盘操作。

**FRs covered:** FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60

**Implementation notes:** 该 Epic 以 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md` 与 `index.html` 为 UI 源头。全屏模式不依赖浏览器 Fullscreen API，不写入 URL；本轮不实现壁纸导出，后续壁纸模板需要另行确认尺寸、文件名、预览和下载交互。

## Epic 1: 快速、可靠的 Pokemon 色彩详情体验

用户可以在现有 SPA 中浏览 Pokemon 名称、图片、主色、色板和搜索切换能力，同时运行时不再依赖完整重 manifest。

### Story 1.1: 生成 compact item 数据契约

As a 维护者,
I want 从原始 Pokopia item manifest 生成精简、可校验的 compact item 数据,
So that 前端和后续推荐逻辑可以使用稳定小体积数据，而不读取完整重 CSV。

**Requirements Covered:** FR31, FR32, FR33, FR37, FR41; NFR1, NFR2, NFR19, NFR21

**Acceptance Criteria:**

**Given** `docs/pokopia_image_sources/item_portraits/manifest.csv` 和相关 placeable item 源数据存在
**When** 维护者运行数据生成命令
**Then** 系统生成 `generated/data/compact-items.json`
**And** 输出包含 `schemaVersion`、稳定排序的 item 列表、slug、名称、分类、tags、图片路径、source traceability 和推荐所需基础字段。

**Given** compact item 数据已生成
**When** schema 校验运行
**Then** compact item 数据符合定义的 schema 或等价结构校验
**And** JSON 字段使用 camelCase，缺失但有语义的字段用 `null` 表达。

**Given** 原始 Pokopia 数据源位于 `docs/pokopia_image_sources/**`
**When** 数据生成命令完成
**Then** 原始数据源未被修改
**And** 生成产物不写入 raw source 目录。

### Story 1.2: 生成 Pokemon 和 item 色彩元数据

As a 用户,
I want Pokemon 详情页展示稳定的主色、色板和 item 主色基础数据,
So that 我可以理解搭配体验的色彩依据。

**Requirements Covered:** FR7, FR8, FR9, FR38, FR42; NFR18, NFR20

**Acceptance Criteria:**

**Given** Pokemon 和 item 本地图片资源存在
**When** 维护者运行数据生成命令
**Then** 系统为全部 Pokemon 生成主色和多色色板数据
**And** 系统为参与推荐的 item 生成主色数据。

**Given** 图片存在透明背景、WebP 或取色失败场景
**When** 颜色提取运行
**Then** 提取逻辑忽略透明像素和近白背景噪声
**And** 失败时记录 `colorSource: "fallback"` 与可追踪 fallback 原因，不让页面空白或构建静默生成坏数据。

**Given** Pokemon 主色或色板需要人工修正
**When** override 数据提供对应字段
**Then** Pokemon metadata 生成优先使用 override
**And** override 数据本身通过 schema 或等价结构校验。

### Story 1.3: 通过 generated data 驱动 Pokemon 浏览

As a 用户,
I want Pokemon 浏览和详情页从 generated data 加载,
So that 页面首屏不再依赖完整 item manifest 作为运行时必需资源。

**Requirements Covered:** FR31, FR33, FR37; NFR1, NFR21, NFR26

**Acceptance Criteria:**

**Given** `generated/data/pokemon-index.json` 和 `generated/data/compact-items.json` 已存在
**When** 用户打开应用
**Then** 浏览器通过 `/data/pokemon-index.json` 和 `/data/compact-items.json` 加载运行时数据
**And** `src/main.ts` 不再 fetch `docs/pokopia_image_sources/item_portraits/manifest.csv` 作为首屏关键路径。

**Given** 用户在开发服务器中运行应用
**When** 浏览器请求 `/data/**`
**Then** Vite dev 环境可以服务 generated data
**And** production build 可以把同一数据复制或输出到 `dist/data/**`。

**Given** generated data 请求失败或 JSON 无法解析
**When** 应用启动
**Then** 页面显示可恢复错误状态
**And** 错误信息指向失败的数据文件而不是空白页。

### Story 1.4: 保留 Pokemon 搜索、切换与色板阅读体验

As a 用户,
I want 在 generated data 驱动下继续搜索、切换和查看 Pokemon 色板,
So that 现有色彩浏览体验不会因为数据管线改造而退化。

**Requirements Covered:** FR2, FR3, FR4, FR5, FR10; NFR6, NFR7, NFR8, NFR9; UX-DR1, UX-DR2, UX-DR3, UX-DR5, UX-DR6

**Acceptance Criteria:**

**Given** Pokemon index 数据已加载
**When** 用户搜索 Pokemon 名称、英文名或编号
**Then** 列表过滤结果正确更新
**And** 用户可以选择结果进入对应详情。

**Given** 用户选中某只 Pokemon
**When** 详情区域渲染
**Then** 页面展示 Pokemon 名称、英文名、图像、编号、主色、色板和文本色值
**And** Pokemon 图片 alt 包含 Pokemon 名称。

**Given** 用户使用键盘浏览搜索、范围过滤和 Pokemon 列表
**When** 焦点移动或控件被触发
**Then** 控件有可读标签且可键盘操作
**And** 移动端窄屏不出现关键文本溢出或不可点击状态。

### Story 1.5: 验证 compact 数据体积与生成稳定性

As a 维护者,
I want 用自动化校验确认 compact 数据小、稳定且可重复生成,
So that 后续推荐和静态页工作建立在可信数据基础上。

**Requirements Covered:** FR37, FR41, FR42; NFR2, NFR5, NFR14, NFR19, NFR20, NFR21, NFR26, NFR27, NFR28, NFR29

**Acceptance Criteria:**

**Given** compact item data 已生成
**When** 维护者运行验证命令
**Then** 校验确认 compact item data gzip 小于 50KB
**And** 完整 `item_portraits/manifest.csv` 不在首屏运行时必需加载路径中。

**Given** 同一 raw manifest、图片和 override 输入
**When** 数据生成命令连续运行两次
**Then** 输出排序和字段顺序保持稳定
**And** runtime 数据不包含当前时间、随机数、本机绝对路径或开发机私有信息。
**And** runtime/build 输出不引入账号、支付、敏感个人数据收集或外部服务密钥。

**Given** 维护者运行项目 build gate
**When** compact data schema、override schema 或体积校验失败
**Then** 命令以非零状态失败
**And** 输出包含可操作的文件路径和失败原因。

## Epic 2: 可解释的 Pokemon 物品推荐体验

用户可以看到基于偏好词、可染色状态和 OKLCH 和谐规则生成的推荐 item，并分页浏览、理解推荐原因；维护者可以用 override 和 fixtures 验证推荐。

### Story 2.1: 基于偏好词和可染色状态筛选推荐候选

As a 用户,
I want 推荐 item 先匹配 Pokemon 偏好词并区分可染色状态,
So that 推荐结果不是随机物品或单纯颜色接近。

**Requirements Covered:** FR12, FR13, FR14, FR15, FR16; NFR15, NFR16

**Acceptance Criteria:**

**Given** Pokemon metadata 包含偏好词，compact item 数据包含名称、分类、tags 和可染色状态
**When** 推荐候选筛选运行
**Then** 只有命中至少一个 Pokemon 偏好词的 item 可以进入候选
**And** 未命中偏好词的 item 被排除并可在调试输出中追踪原因。

**Given** 一个 item 命中偏好词且 `isDyeable` 为 true
**When** 推荐候选筛选运行
**Then** 该 item 可以进入候选
**And** 不要求 item 主色与 Pokemon 主色和谐。

**Given** 一个 item 命中偏好词且 `isDyeable` 为 false
**When** 推荐候选筛选运行
**Then** 该 item 被标记为需要 OKLCH 和谐判断
**And** 不在本故事中绕过该后续判断。

### Story 2.2: 用 OKLCH 和谐判断筛选不可染色 item

As a 用户,
I want 不可染色推荐 item 同时符合偏好词和 OKLCH 色彩和谐,
So that 推荐搭配具有可解释的视觉依据。

**Requirements Covered:** FR11, FR15, FR16, FR19; NFR16, NFR22

**Acceptance Criteria:**

**Given** 不可染色 item 已命中 Pokemon 偏好词
**When** 推荐引擎判断色彩关系
**Then** 系统复用或薄封装 `docs/oklch_color.ts` 的 OKLCH 方法论
**And** 不使用 RGB 距离、HSL 色桶或另一套不一致的颜色接近规则。

**Given** 不可染色 item 未通过 OKLCH 和谐判断
**When** 推荐结果生成
**Then** 该 item 不进入推荐结果
**And** 失败原因可在测试或生成报告中追踪。

**Given** 不可染色 item 通过 OKLCH 和谐判断
**When** 推荐结果生成
**Then** 推荐条目包含 `harmonyStatus` 和 `harmonyType`
**And** harmony 类型来自共享色彩关系逻辑。

### Story 2.3: 生成 deterministic 推荐排序和解释字段

As a 维护者,
I want 为每只 Pokemon 生成稳定排序、可解释的推荐数据,
So that 用户和排查者都能理解每个推荐为何出现。

**Requirements Covered:** FR17, FR18, FR34, FR36, FR47; NFR3, NFR14, NFR17

**Acceptance Criteria:**

**Given** Pokemon metadata、compact item data、颜色数据和推荐候选已准备好
**When** 推荐生成命令运行
**Then** 系统为每只 Pokemon 生成 `generated/data/recommendations/{slug}.json`
**And** 每个推荐文件包含 `schemaVersion`、`pokemonSlug`、`pageSize: 10`、`totalPages` 和推荐列表。

**Given** 推荐条目被写入 JSON
**When** schema 校验运行
**Then** 每个条目包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`
**And** `pageIndex` 在数据中为 zero-based。

**Given** 同一输入数据和算法版本
**When** 推荐生成重复运行
**Then** 排序按 override 优先级、偏好词匹配强度、可染色分支、OKLCH harmony/role fit 和 item slug tie-breaker 稳定输出
**And** 单个 Pokemon 推荐数据 gzip 小于 5KB。

### Story 2.4: 支持 Pokemon metadata override 的颜色、pattern 和搭配道具模式

As a 维护者,
I want 用结构化 override 修正 Pokemon 颜色、pattern 和搭配道具,
So that 自动生成不足时可以精确修正推荐体验。

**Requirements Covered:** FR38, FR39, FR40, FR46; NFR20, NFR23

**Acceptance Criteria:**

**Given** `data/overrides/pokemon-metadata.json` 定义某只 Pokemon 的主色、色板或 pattern
**When** 数据生成命令运行
**Then** 输出 Pokemon metadata 使用 override 值
**And** 生成结果记录 override 来源。

**Given** override 为某只 Pokemon 定义搭配道具追加模式
**When** 推荐数据生成
**Then** override items 被追加到自动推荐结果中
**And** 自动推荐仍保留，排序与 `overrideSource` 可追踪。

**Given** override 为某只 Pokemon 定义搭配道具替换模式
**When** 推荐数据生成
**Then** 该 Pokemon 的推荐列表由 override items 替换自动推荐
**And** 替换行为通过 fixture test 覆盖。

### Story 2.5: 在 SPA 中展示推荐卡片、原因和分页

As a 用户,
I want 浏览某只 Pokemon 的推荐 items、推荐原因和分页,
So that 我可以逐页判断哪些 item 适合搭配。

**Requirements Covered:** FR18, FR19, FR21, FR22, FR23, FR24, FR25; NFR6, NFR8, NFR9; UX-DR4, UX-DR5, UX-DR6

**Acceptance Criteria:**

**Given** 用户选中某只 Pokemon 且推荐 JSON 存在
**When** inspector 渲染推荐区域
**Then** 每张推荐卡展示 item 名称、图像、分类、命中偏好词、是否可染色、主色和适用时的 OKLCH 和谐状态
**And** item 图片 alt 包含 item 名称。

**Given** 推荐结果超过 10 个
**When** 用户浏览推荐区域
**Then** 每页最多展示 10 个 item
**And** 用户可以通过键盘可操作的分页控件前进和后退。

**Given** hydrated 体验中仍有 item 筛选能力
**When** 用户使用现有筛选控件
**Then** 筛选结果与当前 Pokemon 推荐数据保持一致
**And** 不重新读取完整 item manifest。

### Story 2.6: 提供推荐空状态、fixture tests 和排查诊断

As a 维护者,
I want 推荐规则和异常状态有 fixture tests 与诊断字段,
So that 推荐质量问题可以复现和修复。

**Requirements Covered:** FR20, FR45, FR46, FR47; NFR22, NFR23; UX-DR7

**Acceptance Criteria:**

**Given** 某只 Pokemon 自动推荐为空或少于 3 个 item
**When** 推荐 UI 渲染
**Then** 页面展示可恢复空状态或 fallback 推荐状态
**And** 不承诺 fallback 是“最佳”推荐。

**Given** 推荐引擎 fixture tests 运行
**When** 测试覆盖偏好词命中、可染色 item、不可染色 item、OKLCH 分支、override 追加和 override 替换
**Then** 所有关键规则都有确定性断言
**And** 失败信息能指出具体分支。

**Given** 维护者排查某个推荐条目
**When** 查看生成 JSON 或测试输出
**Then** 可以定位命中偏好词、可染色状态、Pokemon 主色、item 主色、和谐判定、rank 和 pageIndex
**And** 推荐条目不缺少复现所需解释字段。

## Epic 3: 可分享、可直接访问的静态 Pokemon 页面

用户可以访问和分享 `/pokemon/{slug}/`，无 JS 时仍能看到核心内容，hydrate 后保持同一 Pokemon、同一推荐和 SPA 交互。

### Story 3.1: 支持 canonical `/pokemon/{slug}/` 路由并保持 hash 兼容

As a 用户,
I want 通过 `/pokemon/{slug}/` 或旧的 `#slug` 访问同一只 Pokemon,
So that 直接访问、分享链接和现有 SPA 导航都能工作。

**Requirements Covered:** FR1, FR30, FR48; NFR13; UX-DR8

**Acceptance Criteria:**

**Given** URL pathname 符合 `/pokemon/{slug}/`
**When** 应用启动并 hydrate
**Then** 应用优先使用 pathname slug 选择 Pokemon
**And** 不先渲染默认 Ditto 后再跳转。

**Given** URL 没有 pathname slug 但包含 `#slug`
**When** 应用启动
**Then** 应用使用 hash slug 选择 Pokemon
**And** 保留现有 hash 导航兼容。

**Given** URL 没有有效 pathname slug 或 hash slug
**When** 应用启动
**Then** 应用使用默认 `ditto`
**And** unknown slug 显示可恢复 not-found 状态而不是崩溃。

### Story 3.2: 为全部 Pokemon 生成无 JS 可读静态详情页

As a 用户,
I want 每只 Pokemon 都有可直接访问的静态详情页,
So that 分享链接和搜索结果打开时不需要等待客户端推荐计算才看到核心内容。

**Requirements Covered:** FR6, FR27, FR35, FR44; NFR4, NFR10, NFR12

**Acceptance Criteria:**

**Given** production build 已生成 app assets、Pokemon metadata 和推荐数据
**When** SSG 生成命令运行
**Then** 系统为全部 311 个 Pokemon 写入 `dist/pokemon/{slug}/index.html`
**And** 输出路径使用稳定 slug。

**Given** 用户在无 JS 或 JS 尚未加载时打开某个静态页
**When** 浏览器渲染 HTML
**Then** 页面包含 Pokemon 名称、图片、主色、色板、文本色值和推荐摘要
**And** 页面不是空 app shell。

**Given** 静态页位于嵌套路由 `/pokemon/{slug}/`
**When** 浏览器加载 CSS、JS、图片和 JSON
**Then** 资源 URL 使用 root-absolute path 或等价安全路径
**And** 不因相对路径错误导致资源 404。

### Story 3.3: 为静态页提供唯一 metadata 和推荐摘要

As a 用户,
I want 分享的 Pokemon 页面有清晰标题、描述和推荐摘要,
So that 接收链接的人能在打开前后理解页面内容。

**Requirements Covered:** FR28, FR29; NFR11

**Acceptance Criteria:**

**Given** SSG 为某只 Pokemon 生成 HTML
**When** 页面写入 `<head>` 和正文摘要
**Then** 每个静态页包含唯一 title 和 description
**And** metadata 与当前 Pokemon slug、名称和推荐摘要一致。

**Given** 某只 Pokemon 有推荐数据
**When** 静态页生成推荐摘要
**Then** 摘要使用该 Pokemon 的推荐数据
**And** 不使用默认 Pokemon 或其他 slug 的推荐内容。

**Given** 某只 Pokemon 推荐为空或数据缺失
**When** 静态页生成
**Then** 页面展示可恢复摘要或空状态
**And** 构建报告记录该 fallback。

### Story 3.4: 验证静态输出、hydrate parity 和 production build gate

As a 维护者,
I want 自动验证静态页、推荐数据和 hydrate 一致性,
So that 可分享页面不会在发布时退化。

**Requirements Covered:** FR30, FR43, FR44, FR48; NFR24, NFR25, NFR26; UX-DR8

**Acceptance Criteria:**

**Given** production build command 运行
**When** 生成 compact data、推荐数据和 SSG 页面后进入 validation
**Then** validation 确认全部 311 个 `/pokemon/{slug}/` 页面存在
**And** 确认每只 Pokemon 都有推荐数据产物。

**Given** validation 抽样检查固定 fixture 页，例如 `ditto`
**When** 检查 `dist/pokemon/ditto/index.html`
**Then** 页面包含标题、图片、主色、色板和推荐摘要
**And** 静态页面与 generated data 的 slug 一致。

**Given** 浏览器 smoke test 运行
**When** 直接访问一个静态 Pokemon 页并完成 hydrate
**Then** hydrate 后页面展示的 Pokemon 与路径 slug 一致
**And** 搜索、切换、筛选和分页能力仍可用。

## Epic 4: Runtime 分发体积与部署边界

维护者可以部署只包含 runtime-required optimized assets/data 的 `dist`，避免把完整 raw Pokopia source data、重复图片目录和 build-only diagnostics 发布出去。

**FRs covered:** FR49, FR50, FR51, FR52

**Implementation notes:** 该 Epic 是 2026-05-14 correct-course 后新增的 release hardening。它不改变现有 UX 和 SSG 目标，而是把图片路径、runtime data contract、Vite copy behavior 和 `validate:dist` budget 收紧为部署可接受的边界。

### Story 4.1: 拆除 raw docs copy，建立 runtime asset manifest

As a 维护者,
I want production build 不再复制完整 raw docs source，并有 runtime asset manifest 作为图片分发边界,
So that `dist` 不包含部署不需要的 source manifests 和重复图片目录。

**Requirements Covered:** FR49, FR50, FR51; NFR1, NFR5, NFR30, NFR31, NFR34

**Acceptance Criteria:**

**Given** production build 运行
**When** Vite closeBundle 或等价 build copy step 执行
**Then** 不再复制 `docs/pokopia_image_sources/**` 到 `dist/docs/**`
**And** `dist/docs/pokopia_image_sources/**` 不存在。

**Given** generated Pokemon index 和 recommendation data 已存在
**When** runtime asset manifest 生成
**Then** manifest 覆盖全部 Pokemon image 和全部被推荐 item image
**And** manifest 条目包含 slug、source category、runtime path、byte size 和 content type。

**Given** browser 或 SSG 引用图片
**When** 读取 image path
**Then** path 指向 `/assets/runtime/**`
**And** path 不指向 `/docs/pokopia_image_sources/**`。

**Given** `validate:dist` 运行
**When** `dist/docs/pokopia_image_sources/**` 存在或生产产物引用 `/docs/pokopia_image_sources/**`
**Then** validation 非零失败。

### Story 4.2: 生成优化后的 runtime image assets

As a 用户,
I want Pokemon 和推荐 item 图片仍然清晰可见,
So that deployment size 降低时不牺牲核心视觉体验。

**Requirements Covered:** FR49, FR50; NFR31, NFR32, NFR34

**Acceptance Criteria:**

**Given** raw Pokemon/item source images 存在
**When** asset generation 运行
**Then** 仅为 runtime manifest allowlist 生成图片
**And** 不为未被 runtime 使用的 raw source image 生成 dist 资产。

**Given** Pokemon portrait 生成
**When** 检查 runtime image
**Then** 最大边长不超过 420px
**And** 默认 WebP quality 82 或等价设置
**And** 单文件小于 64 KiB。

**Given** item portrait 生成
**When** 检查 runtime image
**Then** 最大边长不超过 240px
**And** 默认 WebP quality 82 或等价设置
**And** 单文件小于 32 KiB。

**Given** generated runtime images
**When** `validate:dist` 运行
**Then** runtime image 总体积小于 15 MiB
**And** 所有 manifest/runtime JSON/HTML 引用 path 都存在。

**Given** raw image 存在透明背景或 WebP-behind-PNG
**When** runtime image 生成
**Then** 输出保持可见主体
**And** 不因扩展名和真实 content-type 不一致而失败。

### Story 4.3: 压缩 runtime recommendation/data contract

As a 维护者,
I want recommendation runtime data 不重复存储可从 item/Pokemon index 解析的字段,
So that `/data/recommendations/**` 体积可部署且解释能力仍可保留。

**Requirements Covered:** FR36, FR52; NFR2, NFR3, NFR17, NFR21

**Acceptance Criteria:**

**Given** browser 已加载 runtime item index
**When** recommendation JSON 加载
**Then** UI 可以用 `itemSlug` 解析 item 名称、图片、分类、可染色状态和 item 主色。

**Given** recommendation entry 生成
**When** schema 校验运行
**Then** entry 至少包含 `itemSlug`、`matchedPreferenceTerms`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`
**And** 不再重复存储可从 Pokemon index 或 runtime item index 派生的字段。

**Given** UI 展示推荐原因
**When** 用户查看推荐卡片
**Then** `matchedPreferenceTerms`、可染色状态、主色、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex` 仍可展示或追踪。

**Given** `validate:recommendations` 或 `validate:dist` 运行
**When** recommendation data 体积校验执行
**Then** `dist/data/recommendations/**` raw 小于 12 MiB
**And** `dist/data/recommendations/**` gzip 小于 800 KiB
**And** 单个 Pokemon recommendation gzip 小于 5 KiB。

**Given** compact runtime item data 生成
**When** gzip 体积校验运行
**Then** compact runtime item data gzip 小于 50 KiB
**And** build-only traceability 不进入 runtime JSON。

### Story 4.4: 建立 dist size budget 与部署校验 gate

As a 维护者,
I want `npm run build` 自动验证 deployment size budget 和 runtime boundary,
So that deployment-blocking dist bloat 在合并前被发现。

**Requirements Covered:** FR52; NFR5, NFR24, NFR25, NFR30, NFR32, NFR33, NFR34

**Acceptance Criteria:**

**Given** `npm run build` 完成
**When** `validate:dist` 运行
**Then** 递归计算 `dist` logical byte size
**And** 要求小于 40 MiB。

**Given** `dist` 包含 raw source manifests、raw source image directories、unexpected data files 或 local absolute paths
**When** `validate:dist` 运行
**Then** validation 非零失败
**And** 输出具体违规路径。

**Given** SSG pages 生成
**When** validation 检查全部静态页
**Then** 全部 311 个 `/pokemon/{slug}/index.html` 仍存在
**And** static HTML 中图片 URL 指向 runtime asset path。

**Given** Playwright smoke 直接访问 `/pokemon/ditto/`
**When** hydrate 完成
**Then** 页面展示 Ditto
**And** 推荐图片和 recommendation data 均使用 runtime distribution boundary。

**Given** build budget 被后续改动破坏
**When** `npm run build` 运行
**Then** command 返回非零
**And** 不生成可误部署的 passing build。

## Epic 5: Open Design 全屏展示与偏好档案基础体验

用户可以从当前 Pokemon 详情页进入基于 Open Design 的应用内全屏 overlay，沉浸式查看 Pokemon 图像、身份信息、主色/色板/图案和独立偏好档案，并在桌面、窄屏和移动端保持可读、可退出、可键盘操作。

**FRs covered:** FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60

**Implementation notes:** 该 Epic 以 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/design-spec.md` 与 `_bmad-output/planning-artifacts/open-design-fullscreen-ui/index.html` 为 UI 源头。全屏模式不替换现有三栏/抽屉浏览体验，只作为当前 selected Pokemon 的 overlay。入口位于现有主舞台顶部操作区；退出通过右上角 icon-only close 与 Escape；焦点进入后落到关闭按钮，退出后回到入口。全屏状态不写入 URL、hash、分享链接或 history。本轮不实现壁纸导出；后续壁纸模板必须单独确认导出比例、尺寸、文件名、预览/下载交互。

### Story 5.1: 实现 Open Design 全屏 overlay 入口与退出

As a 用户,
I want 从当前 Pokemon 主舞台进入和退出 Open Design 全屏 overlay,
So that 我可以在不离开当前 Pokemon 页面、不改变分享链接的情况下查看沉浸式全屏展示。

**Requirements Covered:** FR53, FR54, FR58, FR59; NFR35, NFR36, NFR37, NFR39; UX-DR9, UX-DR10, UX-DR11, UX-DR17, UX-DR18

**Acceptance Criteria:**

**Given** 用户已选中任意 Pokemon
**When** 用户点击主舞台顶部操作区的全屏入口
**Then** 应用打开基于 Open Design 的全屏 overlay
**And** overlay 使用当前 selected Pokemon，不切换到默认 Pokemon。

**Given** 全屏 overlay 已打开
**When** 用户查看浏览器 URL、hash 和 history
**Then** 当前 Pokemon canonical path/hash 不因全屏状态改变
**And** 全屏状态不写入分享链接。

**Given** 全屏 overlay 已打开
**When** 用户点击右上角 icon-only close 或按 Escape
**Then** overlay 关闭
**And** 页面回到进入前的同一 Pokemon 详情页状态。

**Given** 用户通过键盘打开全屏 overlay
**When** overlay 完成打开
**Then** 焦点移动到关闭图标按钮
**And** 退出后焦点返回全屏入口。

**Given** 浏览器 Fullscreen API 不可用、被拒绝或未调用
**When** 用户进入全屏模式
**Then** 应用内 overlay 仍完整可用
**And** 不依赖浏览器原生 fullscreen 成功路径。

**Given** 全屏 overlay 顶部工具栏渲染
**When** 用户查看操作区
**Then** 右上角显示语言切换按钮与 icon-only close，语言切换按钮位于关闭按钮左侧
**And** 两个控件都有可读 accessible name。

### Story 5.2: 渲染全屏身份、色彩与偏好档案

As a 用户,
I want 全屏模式按照 Open Design 展示当前 Pokemon 的身份、色彩和偏好档案,
So that 我可以清楚理解这只 Pokemon 的视觉主色、色板构成和喜好/偏好词。

**Requirements Covered:** FR55, FR56, FR57; NFR38, NFR39, NFR40; UX-DR12, UX-DR13, UX-DR14, UX-DR15

**Acceptance Criteria:**

**Given** 全屏 overlay 已打开且 selected Pokemon 数据已加载
**When** 身份区渲染
**Then** 页面展示 Pokemon 名称、编号和 slug
**And** 右侧 Pokemon 画像卡片展示 runtime Pokemon 图像、可读 alt，以及大型编号 figcaption。

**Given** selected Pokemon 有主色
**When** 色彩数值区渲染
**Then** 页面展示 HEX、RGB 和 CMYK 三组数值
**And** RGB/CMYK 从同一主色 deterministic 派生，不写入第二套颜色来源。

**Given** selected Pokemon 有 palette 数据
**When** 色板模块渲染
**Then** 页面按 Open Design 展示色板 swatch、序号、HEX 和 percent
**And** 色板下方渲染中文标题 `图案` 的色彩图案模块。

**Given** selected Pokemon 有 `preferenceTerms`
**When** `偏好档案` 模块渲染
**Then** 所有偏好词以纵向条目展示
**And** 偏好档案作为独立模块存在，不只出现在推荐卡片中。

**Given** selected Pokemon 的 `preferenceTerms` 为空，例如 Ditto
**When** `偏好档案` 模块渲染
**Then** 模块仍可见
**And** 显示可读空状态而不是隐藏模块或留下空白卡片。

**Given** 全屏 overlay 渲染任何用户可见文本
**When** 文本来自 Pokemon metadata、slug、palette 或 preference terms
**Then** 使用 DOM text API 或 HTML escape
**And** 不把 manifest 字段直接拼入未转义 HTML。

### Story 5.3: 验证全屏响应式、可访问性与 Open Design 样本一致性

As a 维护者,
I want 全屏 overlay 有响应式、可访问性和样本验证,
So that Open Design 全屏体验不会在桌面、窄屏、移动端或后续构建中退化。

**Requirements Covered:** FR53, FR54, FR55, FR56, FR57, FR58, FR60; NFR36, NFR37, NFR38, NFR40, NFR41; UX-DR16, UX-DR17, UX-DR18, UX-DR19

**Acceptance Criteria:**

**Given** 视口宽度大于 Open Design 桌面阈值
**When** 全屏 overlay 渲染
**Then** 主体为左侧信息区、右侧 Pokemon 画像卡片的左右结构
**And** 左侧信息区包含上方身份区、下方主色/色板/图案区和偏好档案区。

**Given** 视口进入中窄屏或移动端
**When** 全屏 overlay 渲染
**Then** 布局改为纵向滚动
**And** 信息区在上、Pokemon 画像卡片在下，信息区内部依次显示身份、主色/色板、偏好。

**Given** Open Design 指定样本 `No.180 利欧路`
**When** 全屏 overlay 渲染
**Then** 中文界面、色板、偏好词换行和画像卡牌布局符合 Open Design 标记和视觉结构。

**Given** Open Design 指定样本 `Ditto`
**When** 全屏 overlay 渲染
**Then** `偏好档案` 显示空状态
**And** 空状态不造成布局塌陷。

**Given** Open Design 指定样本 `Pikachu`
**When** 全屏 overlay 在移动视口渲染
**Then** Pokemon 图像与标题尺度不重叠、不横向溢出
**And** 关闭按钮与语言切换按钮仍可点击和键盘访问。

**Given** production build 或 release verification 运行
**When** 全屏相关校验执行
**Then** 验证全屏入口、打开、关闭、Escape、焦点返回、URL 不变和 `/assets/runtime/**` 图片路径
**And** 不引用 `/docs/pokopia_image_sources/**`。

**Given** 用户寻找壁纸导出能力
**When** 本轮 Epic 5 交付完成
**Then** 页面不暴露未实现的导出按钮或假下载能力
**And** 文档保留“壁纸导出后续单独确认”的范围说明。
