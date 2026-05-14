---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments:
  - docs/pokopia_image_sources/summary.md
  - docs/pokopia_image_sources/pokopiadex_placeable_items_summary.md
  - docs/oklch_color.ts
documentCounts:
  productBriefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 3
classification:
  projectType: web_app
  domain: general
  domainSpecialization: color_catalog_recommendation
  complexity: medium
  projectContext: brownfield
  implementationRisk: medium-high
releaseMode: single-release
workflowType: 'prd'
lastEdited: '2026-05-14'
editHistory:
  - date: '2026-05-13'
    changes: 'Clarified immutable raw data sources, build-time compact data generation, and Pokemon metadata override requirements.'
  - date: '2026-05-13'
    changes: 'Resolved PRD validation warnings for measurable fallback criteria, recommendation fields, accessibility alt behavior, SSG assertions, non-goals, and build gate wording.'
  - date: '2026-05-14'
    changes: 'Approved correct-course update for runtime asset boundary, raw source exclusion, dist size budgets, and deployment validation.'
---

# Product Requirements Document - pokopia-color-pattern

**Author:** Grigri
**Date:** 2026-05-12

## Executive Summary

Pokopia Color Pattern 将从单页色板浏览器升级为“颜色驱动的 Pokemon item 推荐目录”。用户进入某只 Pokemon 的页面后，应能快速看到该 Pokemon 的主色、色板、可搭配物品，并获得具有审美感的浏览体验。当前 SPA 已具备基础展示能力，但 item manifest 体积、运行时推荐计算、hash-only 路由限制了首屏性能、快速访问和分享体验。

本 PRD 定义四个 brownfield 改造方向：精简 item manifest 作为数据契约与性能债务治理；将 Pokemon-item 推荐改为构建期预计算；生成 `/pokemon/{slug}/` 静态详情页并在加载后 hydrate 为现有 SPA 交互体验；建立 runtime asset boundary，确保部署产物只包含运行时实际需要的压缩图片和数据。目标是让用户能更快打开、分享、访问某只 Pokemon 的搭配页，并获得稳定、可解释、可部署的推荐结果。

### What Makes This Special

本产品的核心差异不是“按颜色相近找物品”，而是把 Pokemon 偏好与色彩和谐结合成搭配建议。推荐结果必须先命中 Pokemon 偏好词；如果 item 可染色，则只需要满足偏好命中，不要求 item 主色与 Pokemon 主色和谐；如果 item 不可染色，则必须在偏好命中的基础上满足 OKLCH 色彩和谐。这里的“和谐”不是颜色接近，而是基于 `docs/oklch_color.ts` 中的色相关系、明度、彩度和空间角色算法。

Hybrid SSG 让每只 Pokemon 拥有可分享、可快速访问的静态详情页。静态页首屏直接包含标题、Pokemon 图片、主色、色板和推荐物品摘要；hydrate 后继续保留当前 SPA 的搜索、切换、筛选和分页体验。用户价值集中在“为某只 Pokemon 找到合适物品，同时获得美学体验”，而不是单纯优化工程指标。

## Project Classification

- **Project Type:** web_app
- **Domain:** general
- **Domain Specialization:** color_catalog_recommendation
- **Complexity:** medium
- **Project Context:** brownfield
- **Implementation Risk:** medium-high

项目领域本身不涉及监管或高合规要求，但实现涉及数据契约迁移、构建期图片取色、偏好词匹配、可染色 item 分支规则、OKLCH 推荐算法复用、静态页面生成、SEO/share metadata、SPA hydration、runtime asset 分发边界和性能回归验证。因此 PRD 后续应按四个 Epic 拆分：Data Payload / Compact Manifest、Recommendation Engine / Precomputed Matches、Hybrid SSG / Shareable Pokemon Pages、Runtime Distribution / Deployment Budget。

## Success Criteria

### User Success

用户可以通过 `/pokemon/{slug}/` 快速访问某只 Pokemon 的搭配页，并在首屏看到 Pokemon 名称、图片、主色、色板和推荐物品摘要。用户能够理解推荐结果来自 Pokemon 偏好词、item 可染色状态和 OKLCH 色彩和谐，而不是简单颜色接近。

用户在浏览某只 Pokemon 时，可以查看符合偏好词的推荐 items；当匹配结果较多时，以每页 10 个 item 分页浏览。推荐卡片应避免承诺“最佳”，使用“推荐搭配”或“匹配度较高”这类表达。

### Business Success

项目从单页色板工具升级为可分享、可快速访问的 Pokemon 搭配目录。每只 Pokemon 都有稳定 URL，支持用户直接分享和再次访问。性能债务通过 compact item manifest 和构建期推荐数据治理，降低后续新增推荐逻辑和 SSG 页面的维护成本。

### Technical Success

- 初始页面不再依赖完整 `item_portraits/manifest.csv` 作为运行时必需数据。
- compact item manifest 只包含前端运行时字段，并有明确 schema。
- 原始 Pokopia 数据源保持不修改；compact item data、Pokemon metadata 和推荐数据由脚本在每次编译时生成。
- Pokemon metadata override 脚本可在必要时覆盖 Pokemon 主色、色板、pattern 和搭配道具数据。
- Pokemon/item 主色、推荐结果、分页数据在构建期生成，结果 deterministic。
- 推荐算法复用 `docs/oklch_color.ts` 的 OKLCH 颜色关系，不另写不一致规则。
- `/pokemon/{slug}/` 静态页在无 JS 时仍可读核心内容。
- hydrate 后保留当前 SPA 搜索、切换、筛选、分页体验。
- 推荐引擎、compact schema、SSG 输出均有可重复测试或构建断言。

### Measurable Outcomes

- 为全部 311 个 Pokemon 生成静态详情页。
- full item manifest 不再进入首屏关键路径，也不得作为 raw source 被复制进 `dist`。
- `dist/docs/pokopia_image_sources/**` 不得存在。
- runtime 图片只允许来自构建生成的 allowlist，例如 `/assets/runtime/pokemon/**` 与 `/assets/runtime/items/**`。
- runtime image assets 总体积目标小于 15 MiB；单个 Pokemon runtime image 小于 64 KiB，单个 item runtime image 小于 32 KiB。
- compact runtime item data gzip 目标小于 50KB。
- `dist/data/recommendations/**` raw 总体积目标小于 12 MiB，gzip 总体积目标小于 800 KiB，单个 Pokemon 推荐数据 gzip 小于 5KB。
- `dist` uncompressed logical size 目标小于 40 MiB。
- 每个 Pokemon 推荐结果至少包含偏好词命中信息。
- 不可染色 item 必须包含 OKLCH 和谐判定结果。
- 可染色 item 不因主色不和谐被过滤。
- 每页最多展示 10 个推荐 item。
- production build command 必须生成 SSG 页面、预计算数据、runtime image assets，并通过输出校验。

## Product Scope

### Initial Release - Required Scope

- 定义并生成 compact item manifest。
- 保留原始数据源不修改，由编译期脚本从原始数据源生成 compact item data。
- 构建期提取 Pokemon 与 item 主色。
- 提供 Pokemon metadata override 脚本，用于覆盖 Pokemon 主色、色板、pattern 和搭配道具。
- 构建期生成每个 Pokemon 的推荐 item 数据。
- 实现偏好词优先、可染色豁免颜色和谐、不可染色要求 OKLCH 和谐的推荐规则。
- 支持推荐结果分页，每页 10 个 item。
- 生成 `/pokemon/{slug}/` 静态详情页。
- 静态页首屏包含标题、Pokemon 图片、主色、色板和推荐物品摘要。
- hydrate 后继续使用当前 SPA 体验。

### Out of Scope / Non-Goals

- 本次发布不引入用户账号、收藏、评论或同步系统。
- 本次发布不定义外部 API 产品面或第三方集成接口。
- 本次发布不以引入重型 SSG 框架作为前提；优先保持当前 Vite + TypeScript 架构。
- 本次发布不实现高级推荐筛选 UI，例如按色彩角色、item 类型或 override 来源的多维筛选。
- 本次发布不提供人工 curated override 的可视化管理后台；override 以维护者脚本和结构化数据维护。

### Post-Release Opportunities

- 在推荐卡片上展示更细的推荐原因，例如偏好词、可染色、色彩角色。
- 支持按推荐原因、item 分类、可染色状态筛选。
- 增加分享预览 metadata 和社交卡片优化。
- 为推荐质量增加人工 curated overrides。

### Long-Term Direction

- 将 Pokopia Color Pattern 发展成可浏览、可分享、可解释的 Pokemon 室内/物品搭配目录。
- 支持更丰富的搭配场景，例如整套空间方案、主题风格、用户收藏和导出。

## User Journeys

### Journey 1: 为喜欢的 Pokemon 寻找搭配物品

用户想为某只 Pokemon 找到适合摆放或搭配的 Pokopia 物品。他通过分享链接或搜索结果进入 `/pokemon/{slug}/` 静态页，首屏立即看到 Pokemon 名称、图像、主色、色板和推荐物品摘要。页面不需要等待完整 SPA 数据加载才有核心内容。

用户继续浏览推荐物品时，能看到每个 item 与该 Pokemon 的关联原因，例如命中偏好词、可染色、或不可染色但满足 OKLCH 色彩和谐。用户对结果的预期不是“颜色最像”，而是“符合这只 Pokemon 的偏好，并且视觉上搭得起来”。如果结果较多，用户通过每页 10 个 item 的分页继续浏览，而不是一次性被大量物品淹没。

成功时，用户完成一次搭配判断：他找到若干个可以用于 Pokopia 场景布置的 item，并认为推荐既有依据也有审美体验。该旅程要求静态详情页、推荐摘要、推荐原因、分页和 hydrate 后的 SPA 浏览都保持一致。

### Journey 2: 通过分享链接快速回到某只 Pokemon 页面

用户已经知道自己想看 Ditto 或另一只 Pokemon，不想先打开首页再搜索。他访问 `/pokemon/ditto/` 或从朋友分享的链接进入页面。页面必须快速显示 Ditto 的核心内容，并在 hydrate 后保留当前 SPA 的搜索、切换 Pokemon、筛选 item 和分页能力。

边界场景包括：slug 不存在、静态页数据生成缺失、图片取色失败或推荐结果为空。失败时页面应提供可恢复体验，例如回退到默认色板、显示无推荐状态、提供返回索引或搜索入口，而不是空白页或脚本错误。

成功时，用户能把某只 Pokemon 页面当成稳定资源收藏和分享。该旅程要求每个 Pokemon 有稳定 URL、静态可读内容、hydrate 一致性、错误恢复和直接访问支持。

### Journey 3: 维护者更新 Pokopia item 数据并重新生成推荐

维护者需要更新 Pokopia item 数据、图片或推荐逻辑。他保留原始数据源不修改，运行抓取或构建脚本，生成 compact item manifest、Pokemon/item 主色数据、每个 Pokemon 的推荐结果和静态详情页。生成结果必须 deterministic，同一输入应产生同一推荐排序和同一输出文件结构。

当某只 Pokemon 的自动取色、色板、pattern 或搭配道具需要人工修正时，维护者使用 Pokemon metadata override 脚本提供覆盖数据。搭配道具 override 必须支持两种模式：追加到自动推荐结果，或直接替换该 Pokemon 的自动推荐结果。

维护者需要看到数据契约是否有效、输出体积是否符合目标、全部 Pokemon 是否都有静态页、推荐数据是否包含偏好命中与 OKLCH 判定信息。可染色 item 的处理必须可测试：只要求偏好命中，不因颜色不和谐被过滤。不可染色 item 必须同时满足偏好命中与 OKLCH 和谐。

成功时，维护者可以安全更新数据和算法，而不破坏现有 SPA。该旅程要求构建期数据管线、schema 校验、fixture-based tests、输出断言和体积检查。

### Journey 4: 排查推荐或静态页异常

维护者或排查者发现某只 Pokemon 页面推荐不合理，或 `/pokemon/{slug}/` 静态页缺少内容。他需要定位问题来自偏好词、item 可染色状态、主色提取、OKLCH 和谐判定、分页生成、静态页输出，还是 hydrate 之后的 SPA 状态同步。

排查过程需要推荐结果保留足够的解释性字段：命中的偏好词、item 是否可染色、Pokemon 主色、item 主色、OKLCH 判定结果、排序依据和分页位置。没有这些字段，推荐质量无法被验证，也无法修复用户认为“不懂搭配”的问题。

成功时，排查者能从生成产物或测试 fixture 复现问题并修复规则。该旅程要求推荐引擎输出可解释数据、测试样本覆盖关键分支、构建失败信息足够清晰。

### Journey Requirements Summary

这些 journeys 揭示出以下能力需求：

- 每只 Pokemon 必须有可直接访问和分享的 `/pokemon/{slug}/` 静态详情页。
- 静态页必须在 hydrate 前包含核心内容，hydrate 后继续使用当前 SPA 交互。
- 推荐结果必须由构建期生成，并包含可解释字段。
- 推荐规则必须区分可染色 item 与不可染色 item。
- 偏好词命中是所有推荐的前置条件。
- 不可染色 item 必须通过 OKLCH 色彩和谐判定。
- 推荐结果较多时按每页 10 个 item 分页。
- 数据管线必须有 compact schema、稳定输出、体积检查和测试 fixture。
- 原始数据源必须作为不可变输入保留；派生数据必须由编译期脚本生成。
- Pokemon metadata override 必须支持覆盖主色、色板、pattern，并支持搭配道具追加或直接覆盖。
- API/integration user journey 当前不适用；本 PRD 不定义外部 API 产品面。

## Domain-Specific Requirements

### Compliance & Regulatory

本项目属于一般 Web 应用和内容目录工具，不涉及医疗、金融、政府、教育隐私等高监管领域。PRD 不要求行业合规审批、身份认证、支付合规或敏感个人数据处理。

### Technical Constraints

- 推荐结果必须以 Pokemon 偏好词命中为前置条件。
- 可染色 item 不需要满足主色和谐；不可染色 item 必须满足 OKLCH 色彩和谐。
- OKLCH 和谐不是颜色接近，必须依据 `docs/oklch_color.ts` 中的色相关系、明度、彩度和空间角色算法。
- 原始 Pokopia 数据源不得为 compact manifest 或推荐结果而被手工修改。
- compact item data、Pokemon metadata、推荐数据和 SSG 页面必须由编译期脚本从原始数据源与 override 数据生成。
- Pokemon metadata override 必须独立于原始数据源保存，并能覆盖 Pokemon 主色、色板、pattern 和搭配道具。
- 搭配道具 override 必须支持追加模式和直接覆盖模式。
- Pokemon 与 item 主色提取必须可重复；图片取色失败时必须有 fallback，不得阻塞构建或导致静态页空白。
- 构建期生成数据必须 deterministic；同一输入数据和算法版本应生成相同推荐排序。
- 推荐结果必须保留解释字段，以支持用户理解和维护者排查。

### Integration Requirements

- 数据来源为仓库内已抓取的 Pokopia Pokemon/item manifest、图片资源和 `docs/oklch_color.ts`。
- 构建流程必须兼容当前 Vite + TypeScript 项目，不引入重型框架作为 SSG 前提。
- SSG 输出必须与当前 SPA hydrate 模型兼容，避免静态页与客户端状态出现不同 Pokemon、不同推荐或不同分页。

### Risk Mitigations

- 推荐可信度风险：通过偏好词命中、可染色分支、OKLCH 和谐判定和推荐原因字段降低“看起来随机”的风险。
- 性能回归风险：通过 compact manifest、单 Pokemon 推荐数据和构建产物体积检查降低首屏 payload。
- 数据漂移风险：通过 schema 校验和 fixture tests 捕获 manifest 字段变化。
- SSG/hydration 不一致风险：通过 build output assertion 和浏览器级 smoke test 验证直接访问与客户端导航一致。

## Innovation & Novel Patterns

### Detected Innovation Areas

本项目的创新不在于新技术栈，而在于将 Pokemon 偏好词、item 可染色能力、图片主色提取、OKLCH 色彩和谐与可分享静态色卡页组合为一个搭配推荐体验。推荐规则明确反对“颜色越接近越好”的简单逻辑，而是将“偏好适配”作为必要条件，将“色彩和谐”作为不可染色 item 的视觉约束。

### Market Context & Competitive Landscape

现有通用图鉴或 item 列表通常强调收集、分类、图片和来源信息；本项目强调“某只 Pokemon 应搭配什么 item”以及“推荐为什么视觉上成立”。PRD 不假设市场上不存在相似工具，但该组合对本项目用户的价值是：从静态列表转向可解释的审美搭配目录。

### Validation Approach

- 用 fixture 覆盖可染色与不可染色 item 的分支行为。
- 用固定 Pokemon/item 样本验证偏好词命中是推荐前置条件。
- 用固定颜色样本验证 OKLCH 和谐逻辑复用 `docs/oklch_color.ts`。
- 用浏览器 smoke test 验证静态页首屏内容和 hydrate 后 SPA 状态一致。
- 用输出体积检查验证 compact manifest 和单 Pokemon 推荐数据达到性能目标。

### Risk Mitigation

- 如果推荐质量不足，先暴露推荐原因字段，方便修正规则，而不是隐藏算法细节。
- 如果 OKLCH 结果过窄导致推荐过少，允许在 PRD 后续阶段定义 curated overrides 或 fallback 推荐。
- 如果 SSG 复杂度超过收益，初始发布仍应保留简单 Vite 构建脚本方案，不引入重型框架作为前提。

## Web App Specific Requirements

### Project-Type Overview

Pokopia Color Pattern 是一个 brownfield Web 应用，当前由 Vite + TypeScript 构建，主要体验为 SPA。目标架构是 Hybrid SSG：构建期生成 `/pokemon/{slug}/` 静态详情页，页面加载后 hydrate 为现有 SPA 体验。该项目不定义移动原生能力、CLI 产品面或外部 API。

### Technical Architecture Considerations

- 保留 Vite + TypeScript 作为基础构建栈。
- 通过构建脚本生成 compact manifest、预计算推荐数据和静态 Pokemon 页面。
- SPA 入口与静态详情页必须共享同一套数据契约，避免静态 HTML 与 hydrate 后状态不一致。
- 推荐计算不得依赖用户浏览器在运行时扫描完整 item manifest。
- 图片取色、OKLCH 判定和推荐排序应在构建期完成。

### Browser Matrix

- 支持当前主流现代浏览器：Chrome、Safari、Firefox、Edge 的近两个稳定版本。
- 不要求支持 Internet Explorer。
- 无 JS 时，`/pokemon/{slug}/` 静态页必须展示核心内容；完整搜索、切换、筛选和分页体验可依赖 JS hydrate。

### Responsive Design

- 静态详情页和 hydrated SPA 必须在移动端与桌面端可用。
- 移动端首屏应优先展示 Pokemon 名称、图片、主色和推荐摘要。
- 推荐 item 分页、筛选和卡片内容不得在窄屏中出现文字溢出或不可点击状态。

### Performance Targets

- full item manifest 不进入首屏关键路径，也不得随 raw source 目录进入 `dist`。
- compact runtime item data gzip 小于 50KB。
- 单个 Pokemon 推荐数据 gzip 小于 5KB，且 `dist/data/recommendations/**` raw 总体积小于 12 MiB、gzip 总体积小于 800 KiB。
- runtime image assets 总体积小于 15 MiB，单个 Pokemon runtime image 小于 64 KiB，单个 item runtime image 小于 32 KiB。
- `dist` uncompressed logical size 小于 40 MiB。
- 静态详情页首屏无需等待推荐引擎运行即可展示核心内容。
- 构建输出必须包含体积或文件存在断言，防止 payload 回归。

### SEO Strategy

- 每个 Pokemon 生成稳定静态 URL：`/pokemon/{slug}/`。
- 每个静态页包含唯一 title、description、Pokemon 图片、主色、色板和推荐摘要。
- 直接访问静态页应返回可索引 HTML，而不是只有空 shell。
- SEO 不是唯一目标；分享和快速访问同等重要。

### Accessibility Level

- 目标为基础 WCAG 2.2 AA 可访问性。
- 色板必须提供文本色值，不只依赖颜色视觉。
- Pokemon 图片 alt 必须包含 Pokemon 名称；推荐 item 图片 alt 必须包含 item 名称；纯装饰图或占位图使用空 alt，并可用边框加透明百变怪剪影作为视觉占位。
- 分页与筛选控件必须支持键盘操作和可读标签。

### Implementation Considerations

- compact manifest 应有 schema 和向后迁移说明。
- 原始数据源应作为只读输入处理；compact 数据和推荐数据应在每次编译时重新生成。
- Pokemon metadata override 应有明确 schema，并在构建期参与生成 Pokemon 主色、色板、pattern 和推荐结果。
- 推荐引擎应输出解释字段，支持 UI 展示和调试。
- SSG 生成应避免引入重型框架；优先使用现有 Vite 构建和 Node 脚本。
- hydrate 后应根据当前路径解析 Pokemon slug，而不是只依赖 URL hash。

## Project Scoping

### Strategy & Philosophy

**Approach:** 单次 brownfield 改造发布。Epic 用于组织工作，不表示分阶段交付；Data Payload、Recommendation Engine、Hybrid SSG 和 Runtime Distribution 都属于本次发布范围。

**Resource Requirements:** 需要 TypeScript/Vite 前端能力、Node 构建脚本能力、浏览器 smoke test 能力，以及对当前 Pokopia 数据 manifest 和 `docs/oklch_color.ts` 的理解。

### Complete Feature Set

**Core User Journeys Supported:**

- 用户通过 `/pokemon/{slug}/` 直接访问或分享某只 Pokemon 的搭配页。
- 用户查看 Pokemon 主色、色板、推荐 item 摘要和推荐原因。
- 用户在 hydrate 后继续使用现有 SPA 搜索、切换、筛选和分页。
- 维护者通过构建流程生成 compact manifest、预计算推荐数据和静态详情页。
- 维护者排查推荐异常时可查看偏好词、可染色状态、主色和 OKLCH 判定字段。

**Must-Have Capabilities:**

- Compact item manifest schema 和构建产物。
- 原始数据源只读保留，compact item data 每次编译生成。
- Pokemon 与 item 主色构建期提取。
- Pokemon metadata override 脚本，支持覆盖主色、色板、pattern，并支持搭配道具追加或替换。
- 基于偏好词、可染色状态和 OKLCH 和谐的 deterministic 推荐引擎。
- 每个 Pokemon 的推荐结果与分页数据。
- `/pokemon/{slug}/` 静态详情页生成。
- 静态页首屏核心内容和 hydrate 后 SPA 连续体验。
- 构建输出、推荐 fixture、体积目标和 SSG 页面存在性校验。

**Nice-to-Have Capabilities:**

- 更丰富的推荐原因 UI，例如色彩角色、和谐类型、偏好词权重。
- 人工 curated overrides。
- 更完整的社交分享卡片视觉优化。
- 高级筛选，例如只看可染色 item、只看某类 item、只看某种色彩角色。

### Risk Mitigation Strategy

**Technical Risks:** 推荐引擎、SSG、hydrate 和 runtime asset 分发同时改动，存在集成风险。通过 Epic 边界、fixture tests、build output assertion、dist size budget 和浏览器 smoke test 控制风险。

**Market Risks:** 用户可能不认同推荐结果。通过推荐原因字段、偏好词前置规则、可染色 item 分支规则和 OKLCH 和谐解释降低不信任风险。

**Resource Risks:** 如果实现资源不足，不能移除用户明确要求的三项核心能力；应先保持 UI 简单，减少高级筛选和 curated overrides，而不是削减 compact manifest、推荐预计算或 `/pokemon/{slug}/` 静态页。

## Functional Requirements

### Pokemon Discovery and Detail Pages

- FR1: 用户可以直接访问某只 Pokemon 的稳定详情页。
- FR2: 用户可以在 Pokemon 详情页看到 Pokemon 名称、英文名、图像和编号。
- FR3: 用户可以在 Pokemon 详情页看到该 Pokemon 的主色和色板。
- FR4: 用户可以从某只 Pokemon 详情页继续切换到其他 Pokemon。
- FR5: 用户可以搜索 Pokemon 并进入对应详情内容。
- FR6: 用户可以在无脚本或脚本尚未加载完成时读取 Pokemon 详情页核心内容。

### Color Palette and Aesthetic Context

- FR7: 系统可以为每只 Pokemon 提供主色数据。
- FR8: 系统可以为每只 Pokemon 提供多色色板数据。
- FR9: 系统可以为每个参与推荐的 item 提供主色数据。
- FR10: 用户可以查看色板颜色值，以便理解搭配依据。
- FR11: 系统可以将颜色关系归类为可用于搭配判断的和谐关系。

### Item Recommendation

- FR12: 系统可以基于 Pokemon 偏好词筛选候选 items。
- FR13: 系统可以识别 item 是否可染色。
- FR14: 系统可以让可染色 item 在命中偏好词后进入推荐候选，而不要求主色和谐。
- FR15: 系统可以让不可染色 item 在命中偏好词后继续接受色彩和谐判断。
- FR16: 系统可以排除未命中 Pokemon 偏好词的 item。
- FR17: 系统可以为每只 Pokemon 生成推荐 item 列表。
- FR18: 系统可以为每个推荐 item 提供推荐原因。
- FR19: 用户可以区分推荐 item 是因为偏好词、可染色状态还是色彩和谐进入结果。
- FR20: 系统可以在推荐结果为空，或自动推荐少于 3 个 item 时，提供可恢复的空状态或 fallback 推荐状态。

### Recommendation Browsing

- FR21: 用户可以浏览某只 Pokemon 的推荐 items。
- FR22: 用户可以按每页 10 个 item 查看推荐结果。
- FR23: 用户可以在推荐结果页之间前进和后退。
- FR24: 用户可以在推荐 item 卡片中看到 item 名称、图像、分类、命中偏好词、是否可染色、主色和适用时的 OKLCH 和谐状态。
- FR25: 用户可以在 hydrated 体验中继续使用现有 item 筛选能力。

### Sharing and Fast Access

- FR26: 用户可以分享某只 Pokemon 的稳定详情页 URL。
- FR27: 被分享的详情页可以在直接访问时展示该 Pokemon 的核心内容。
- FR28: 系统可以为每只 Pokemon 详情页提供页面级标题和描述内容。
- FR29: 系统可以为每只 Pokemon 详情页提供推荐摘要内容。
- FR30: 系统可以在详情页加载完成后保留 SPA 的搜索、切换、筛选和分页能力。

### Data Contract and Generation

- FR31: 系统可以提供精简 item 数据契约，只包含前端运行时和推荐展示所需字段。
- FR32: 系统必须保留原始 Pokopia 数据源不修改，并将其作为只读输入。
- FR33: 系统可以在每次编译时从原始数据源生成 compact item 数据。
- FR34: 系统可以生成每只 Pokemon 的推荐数据。
- FR35: 系统可以生成每只 Pokemon 的静态详情页内容。
- FR36: 系统可以为推荐数据保留解释字段，以支持 UI 展示和排查。
- FR37: 维护者可以重新生成 compact item 数据、推荐数据和静态详情页。
- FR38: 维护者可以通过 Pokemon metadata override 脚本覆盖 Pokemon 主色、色板和 pattern。
- FR39: 维护者可以通过 Pokemon metadata override 脚本追加某只 Pokemon 的搭配道具。
- FR40: 维护者可以通过 Pokemon metadata override 脚本直接覆盖某只 Pokemon 的搭配道具列表。

### Validation and Maintenance

- FR41: 维护者可以验证 compact item 数据符合定义的 schema。
- FR42: 维护者可以验证 Pokemon metadata override 数据符合定义的 schema。
- FR43: 维护者可以验证每只 Pokemon 都有推荐数据产物。
- FR44: 维护者可以验证每只 Pokemon 都有静态详情页产物。
- FR45: 维护者可以用固定样本验证推荐规则覆盖偏好词、可染色 item 和不可染色 item。
- FR46: 维护者可以用固定样本验证 override 的搭配道具追加与直接覆盖行为。
- FR47: 维护者可以排查推荐结果中使用的偏好词、可染色状态、主色和和谐判定。
- FR48: 系统可以在输入数据缺失、图片取色失败或 slug 不存在时提供明确恢复路径。

### Runtime Distribution and Deployment

- FR49: 系统可以从 raw image source allowlist 生成运行时图片资产，而不是直接分发完整 raw source 图片目录。
- FR50: 系统可以生成 runtime asset manifest，将 Pokemon 和推荐 item 的源图片映射到 `/assets/runtime/**` 分发路径。
- FR51: 系统可以在 production build 中排除 `docs/pokopia_image_sources/**` raw source、raw CSV/JSON manifest 和 build-only diagnostics。
- FR52: 维护者可以验证 `dist` 总体积、runtime image 体积、runtime data 体积、raw source exclusion 和静态页资源引用。

## Non-Functional Requirements

### Performance

- NFR1: 完整 `item_portraits/manifest.csv` 不得作为首屏运行时必需资源加载，也不得随 raw source 目录复制到 `dist`。
- NFR2: compact runtime item data gzip 后必须小于 50KB；build-only traceability data 可以保留在 `generated/**`，但不得进入 runtime payload。
- NFR3: 单个 Pokemon 推荐数据 gzip 后必须小于 5KB，且 `dist/data/recommendations/**` raw 总体积小于 12 MiB、gzip 总体积小于 800 KiB。
- NFR4: `/pokemon/{slug}/` 静态页首屏核心内容不得依赖客户端推荐计算完成后才出现。
- NFR5: 构建流程必须校验 `dist` total size、runtime image size、runtime data size、raw source exclusion 和 SSG 页面存在性，防止 payload 回归。
- NFR30: `dist` uncompressed logical size 必须小于 40 MiB；`dist/docs/pokopia_image_sources/**` 必须不存在。
- NFR31: runtime image assets 必须由构建脚本从 raw image source allowlist 生成，默认输出 WebP 或等价压缩格式，并保留必要 alt/metadata 映射。
- NFR32: runtime image assets 总体积必须小于 15 MiB；单个 Pokemon runtime image 小于 64 KiB，单个 item runtime image 小于 32 KiB。

### Accessibility

- NFR6: 页面目标满足基础 WCAG 2.2 AA。
- NFR7: 色板必须提供文本色值，不得只依赖颜色块传达信息。
- NFR8: 搜索、筛选、分页和推荐浏览控件必须支持键盘操作。
- NFR9: Pokemon 图片 alt 必须包含 Pokemon 名称；推荐 item 图片 alt 必须包含 item 名称；纯装饰图或占位图必须使用空 alt，并可用边框加透明百变怪剪影作为视觉占位。

### Static Access and Shareability

- NFR10: 全部 311 个 Pokemon 必须生成可直接访问的 `/pokemon/{slug}/` 静态页面。
- NFR11: 每个静态页面必须包含唯一 title、description 和可读正文摘要。
- NFR12: 静态页面在无 JS 时必须保留 Pokemon 名称、图片、主色、色板和推荐摘要。
- NFR13: hydrate 后页面展示的 Pokemon 与直接访问路径中的 slug 必须一致。

### Data Correctness and Determinism

- NFR14: 同一输入 manifest、图片和算法版本必须生成相同推荐排序。
- NFR15: 可染色 item 不得因主色不和谐被过滤。
- NFR16: 不可染色 item 必须同时满足偏好词命中和 OKLCH 和谐判定。
- NFR17: 推荐解释契约必须能通过 recommendation entry 或 validated runtime lookup 复现 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`；entry 本身至少保留 `itemSlug`、`matchedPreferenceTerms`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank` 和 `pageIndex`。
- NFR18: 图片取色失败时必须优先使用 Pokemon metadata override；没有 override 时使用默认中性色和空色板，并在生成结果中记录 `colorSource: fallback`。

### Maintainability and Verification

- NFR19: compact item manifest 必须有 schema 或等价结构校验。
- NFR20: Pokemon metadata override 必须有 schema 或等价结构校验。
- NFR21: 编译流程必须从原始数据源和 override 数据重新生成 compact data、推荐数据、runtime asset manifest/assets 和 SSG 页面。
- NFR22: 推荐引擎必须有 fixture-based tests 覆盖偏好词、可染色、不可染色和 OKLCH 分支。
- NFR23: 推荐引擎必须有 fixture-based tests 覆盖搭配道具 override 的追加和直接覆盖模式。
- NFR24: SSG 输出必须有构建断言验证全部 311 个 `/pokemon/{slug}/` 页面存在，并抽样验证 `ditto` 等固定 fixture 页包含标题、图片、主色、色板和推荐摘要。
- NFR25: 浏览器 smoke test 必须覆盖一个直接访问静态页并 hydrate 的路径。
- NFR26: production build command 必须在生成 compact data、推荐数据和 SSG 页面后成功完成。
- NFR33: production build command 必须在生成 runtime image assets、删除或跳过 raw docs copy、完成 size budget 校验后成功完成。
- NFR34: 静态 HTML、runtime JSON 和 browser bundle 不得引用 `/docs/pokopia_image_sources/**` 作为生产图片路径；生产图片引用必须指向 `/assets/runtime/**` 或等价 runtime allowlist 路径。

### Security and Privacy

- NFR27: 本项目不得引入用户账号、支付信息或敏感个人数据收集作为本 PRD 范围。
- NFR28: 构建脚本不得要求将外部服务密钥写入前端产物。
- NFR29: 静态页面和数据文件不得暴露本地绝对路径或开发机私有信息。
