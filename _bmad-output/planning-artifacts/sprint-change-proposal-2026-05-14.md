---
project: pokopia-color-pattern
workflow: bmad-correct-course
date: 2026-05-14
status: approved
change_scope: moderate
mode: batch
trigger: dist 体积达到 245M，部署受阻
approved_at: 2026-05-14T11:09:03+0800
---

# Sprint Change Proposal - Runtime Asset Boundary 与 Dist 体积治理

## 1. Issue Summary

当前项目已经完成 Epic 1-3 的 Vite + TypeScript + SSG 改造，但 release build 的 `dist` 目录体积过大，部署受阻。

本次触发问题不是用户体验需求变化，而是实施后暴露出的部署约束：现有 `vite.config.ts` 在 build 后把完整 `docs/pokopia_image_sources/**` raw source 复制到 `dist/docs/pokopia_image_sources/**`。这保留了运行时图片路径，但也把 raw manifest、重复图片目录、源 CSV/JSON 和构建输入一起带进部署产物。

本次本地证据：

- `du -sh dist`：245M
- `du -sh dist/docs`：211M
- `du -sh dist/data`：30M
- `du -sh dist/data/recommendations`：28M
- `dist/docs/pokopia_image_sources` 文件数：2318
- 逻辑字节统计：`dist` 199.37 MiB，其中 `dist/docs/pokopia_image_sources` 173.85 MiB，`dist/data/recommendations` 20.79 MiB
- 当前实际运行时会引用的图片集合为 311 个 Pokemon portrait + 569 个被推荐 item portrait，源图合计约 76.20 MiB
- 使用现有 `sharp` 按 Pokemon 最大 420px、item 最大 240px、WebP quality 82 做无落盘估算后，运行时图片可降至约 8.95 MiB
- 将 recommendation JSON 改为只保留推荐解释字段和 `itemSlug`，把名称、图片、分类、颜色等从 runtime item index 解析，估算 `dist/data/recommendations` 可由 20.79 MiB 降至约 10.55 MiB，gzip 合计由 1.75 MiB 降至约 0.62 MiB

## 2. Checklist Findings

- [x] 1.1 Trigger story：Story 3.4 `验证静态输出、hydrate parity 和 production build gate` 完成后，部署前发现 final `dist` 体积不可接受。
- [x] 1.2 Core problem：技术限制 / failed distribution approach。原架构只要求 full item manifest 不进入首屏关键路径，但没有禁止 raw docs/source 进入部署产物。
- [x] 1.3 Evidence：`dist/docs` 占 211M，`dist/data/recommendations` 占 28M，图片和推荐 JSON 是主要优化对象。
- [x] 2.1 Current epic impact：Epic 3 的静态输出仍可成立，但需要补充部署产物边界与体积 budget。
- [x] 2.2 Epic-level changes：新增一个 corrective Epic，比改写已完成 Epic 1-3 更清晰。
- [x] 2.3 Remaining epic impact：当前所有 epics/stories 已 done；无需重排原 15 个 stories。
- [x] 2.4 New epic needed：需要新增 Epic 4 `Runtime 分发体积与部署边界`。
- [x] 2.5 Priority：必须先于正式部署执行。
- [x] 3.1 PRD conflict：PRD 只定义首屏关键路径与 gzip data budget，缺少完整 `dist` size budget、raw source 禁止规则、runtime image boundary。
- [x] 3.2 Architecture conflict：Architecture 中 `vite.config.ts` 继续复制 required docs/assets 的表述过宽，会延续 raw docs 复制问题。
- [N/A] 3.3 UX conflict：UI/UX 不需要重做；图片路径改变应保持现有视觉与无 JS 内容。
- [x] 3.4 Other artifacts：`_bmad-output/project-context.md`、`vite.config.ts`、`scripts/generate-data.ts`、`scripts/generate-ssg.ts`、`scripts/validate-build.ts`、`src/data/schemas.ts`、`src/main.ts`、Playwright smoke 都需要跟随更新。
- [x] 4.1 Direct Adjustment：可行。新增 corrective epic/stories 并实现 asset/data boundary。
- [ ] 4.2 Potential Rollback：不可取。无需回滚 SSG 或推荐功能，问题在分发边界。
- [ ] 4.3 PRD MVP Review：不需要缩减 MVP。核心目标仍成立，只需增加部署产物约束。
- [x] 4.4 Recommended path：Direct Adjustment + 新增 Epic 4。

## 3. Impact Analysis

### Epic Impact

Epic 1-3 的产品能力不应回滚：

- Epic 1 仍提供 Pokemon index、compact item data 和色彩基础数据。
- Epic 2 仍提供 per-Pokemon 推荐、解释字段、override 和推荐 UI。
- Epic 3 仍提供 `/pokemon/{slug}/` SSG、metadata、hydrate parity 和 build gate。

需要新增 Epic 4：

> Epic 4: Runtime 分发体积与部署边界
> 目标：把 raw source、build-only data 和 runtime deployment 明确分离；最终 `dist` 只包含浏览器和静态页实际需要的图片、JSON、HTML、CSS、JS，并由 build gate 强制 size budget。

### Story Impact

原 stories 保留 done，不直接重写完成记录。新增 corrective stories：

1. Story 4.1: 拆除 raw docs copy，建立 runtime asset manifest
2. Story 4.2: 生成优化后的 runtime image assets
3. Story 4.3: 压缩 runtime recommendation/data contract
4. Story 4.4: 建立 dist size budget 与部署校验 gate

### Artifact Conflicts

PRD 需要更新：

- Measurable Outcomes
- Performance Targets
- NFR Performance
- Maintainability and Verification

Architecture 需要更新：

- Data Architecture / Distribution output
- Static Rendering & Hydration image path rules
- Infrastructure & Deployment
- Project Structure & Boundaries
- Development Workflow Integration

Epics/stories 需要更新：

- `epics.md` 增加 Epic 4 和 4 个 corrective stories
- `sprint-status.yaml` 增加 Epic 4 backlog/ready 状态
- 新增对应 story files，供后续 `bmad-dev-story` 执行

Project context 需要更新：

- 移除“`vite.config.ts` 已有构建后复制 `docs/pokopia_image_sources`”作为应遵守规则的表述。
- 新增“raw docs/source 不得进入 `dist`；runtime image/data 必须通过 allowlist/manifest 分发”的规则。

## 4. Recommended Approach

选择 Direct Adjustment，不回滚、不缩 MVP。

理由：

- 当前功能方向正确，部署失败来自产物边界缺失，不是需求错误。
- Raw source 不应是 runtime contract；当前 `/docs/...` 图片路径只是历史实现细节。
- 图片优化收益最大：完整 raw docs/source 复制移除后，再把实际引用图片生成 WebP 缩略产物，可以把图片分发从百兆级压到约 10-15 MiB。
- recommendation JSON 是第二优先级：当前每个 entry 重复 item 名称、图片、分类和 Pokemon 主色，很多字段可由 `pokemon-index` 与 runtime item index 解析。
- 新增 Epic 4 比修改完成 stories 更符合审计语义：原 stories 交付了功能，Epic 4 交付部署边界和 release hardening。

Scope classification：Moderate。需要产品文档、架构文档、story backlog 和多个构建脚本/运行时代码同时更新，但不需要重新设计产品目标或迁移技术栈。

## 5. Detailed Change Proposals

### PRD - Measurable Outcomes

OLD:

```md
- full item manifest 不再进入首屏关键路径。
- compact item data gzip 目标小于 50KB。
- 单个 Pokemon 推荐数据 gzip 目标小于 5KB。
- production build command 必须生成 SSG 页面和预计算数据，并通过输出校验。
```

NEW:

```md
- full item manifest 不再进入首屏关键路径，也不得作为 raw source 被复制进 `dist`。
- `dist` 不得包含 `dist/docs/pokopia_image_sources/**`。
- runtime 图片只允许来自构建生成的 allowlist，例如 `/assets/runtime/pokemon/**` 与 `/assets/runtime/items/**`。
- runtime image assets 总体积目标小于 15 MiB；单个 Pokemon runtime image 小于 64 KiB，单个 item runtime image 小于 32 KiB。
- compact runtime item data gzip 目标小于 50KB。
- `dist/data/recommendations/**` raw 总体积目标小于 12 MiB，gzip 总体积目标小于 800 KiB，单个 Pokemon 推荐数据 gzip 小于 5KB。
- `dist` uncompressed logical size 目标小于 40 MiB。
- production build command 必须生成 SSG 页面、预计算数据、runtime image assets，并通过输出校验。
```

Rationale：原 PRD 只约束首屏和单文件 gzip，未约束部署目录整体体积，也未禁止 raw source 发布。

### PRD - NFR Performance

OLD:

```md
- NFR1: 完整 `item_portraits/manifest.csv` 不得作为首屏运行时必需资源加载。
- NFR2: compact item data gzip 后必须小于 50KB。
- NFR3: 单个 Pokemon 推荐数据 gzip 后必须小于 5KB。
- NFR5: 构建流程必须输出或校验关键数据产物体积，防止 payload 回归。
```

NEW:

```md
- NFR1: 完整 `item_portraits/manifest.csv` 不得作为首屏运行时必需资源加载，也不得随 raw source 目录复制到 `dist`。
- NFR2: compact runtime item data gzip 后必须小于 50KB；build-only traceability data 可以保留在 `generated/**`，但不得进入 runtime payload。
- NFR3: 单个 Pokemon 推荐数据 gzip 后必须小于 5KB，且 `dist/data/recommendations/**` raw 总体积小于 12 MiB。
- NFR5: 构建流程必须校验 `dist` total size、runtime image size、runtime data size、raw source exclusion 和 SSG 页面存在性，防止 payload 回归。
- NFR30: `dist` uncompressed logical size 必须小于 40 MiB；`dist/docs/pokopia_image_sources/**` 必须不存在。
- NFR31: runtime image assets 必须由构建脚本从 raw image source allowlist 生成，默认输出 WebP 或等价压缩格式，并保留必要 alt/metadata 映射。
```

Rationale：新增可部署 budget 与 raw/source exclusion，允许 build-only 数据继续保留在 `generated/**`。

### Architecture - Data Architecture

OLD:

```md
- Generated runtime output:
  - `generated/data/pokemon-index.json`
  - `generated/data/compact-items.json`
  - `generated/data/recommendations/{slug}.json`
  - `generated/data/build-summary.json`
- Distribution output:
  - `dist/data/**`
  - `dist/pokemon/{slug}/index.html`
```

NEW:

```md
- Build-only generated output:
  - `generated/data/**`
  - `generated/reports/**`
  - raw path traceability and source diagnostics
- Runtime distribution output:
  - `dist/data/pokemon-index.json`
  - `dist/data/runtime-items.json` or minimized `dist/data/compact-items.json`
  - `dist/data/recommendations/{slug}.json`
  - `dist/assets/runtime/pokemon/{slug}.webp`
  - `dist/assets/runtime/items/{slug}.webp`
  - `dist/assets/runtime/asset-manifest.json`
  - `dist/pokemon/{slug}/index.html`
- Forbidden distribution output:
  - `dist/docs/pokopia_image_sources/**`
  - raw CSV/JSON source manifests
  - build-only color extraction diagnostics unless explicitly allowlisted
```

Rationale：Architecture 需要把 source、build-only generated、runtime distribution 分成三层。

### Architecture - Infrastructure & Deployment

OLD:

```md
- `vite.config.ts` continues copying required docs/assets and also copies/serves generated `/data/`.
```

NEW:

```md
- `vite.config.ts` must not copy `docs/pokopia_image_sources/**` into `dist`.
- A runtime asset generation step creates optimized images and a manifest before SSG validation.
- Vite dev middleware may serve raw source images only in development behind the same runtime URL contract, or serve generated runtime assets after `generate:data`.
- Production build copies only allowlisted `/data/**` and `/assets/runtime/**`.
- `validate:dist` fails if any `dist/docs/pokopia_image_sources/**` path exists or if runtime data references a missing runtime asset.
```

Rationale：当前 `vite.config.ts` 的 copy behavior 是部署体积问题的直接原因。

### Epics - Add Epic 4

NEW:

```md
### Epic 4: Runtime 分发体积与部署边界

As a maintainer,
I want final `dist` to contain only runtime-required optimized assets and data,
So that the static SSG app can be deployed without shipping raw Pokopia source data.

Success Criteria:
- `dist/docs/pokopia_image_sources/**` 不存在。
- `dist` uncompressed logical size 小于 40 MiB。
- runtime image assets 小于 15 MiB。
- `dist/data/recommendations/**` raw 小于 12 MiB，gzip 小于 800 KiB。
- `npm run build` 在 size budget、missing asset、unexpected raw source 任一失败时返回非零。
```

### Story 4.1 - 拆除 raw docs copy，建立 runtime asset manifest

Acceptance Criteria:

- Given production build 运行, when Vite closeBundle 执行, then 不再复制 `docs/pokopia_image_sources/**` 到 `dist/docs/**`。
- Given generated Pokemon index 和 recommendation data 已存在, when runtime asset manifest 生成, then manifest 覆盖全部 Pokemon image 和全部被推荐 item image。
- Given browser 或 SSG 引用图片, when 读取 image path, then path 指向 `/assets/runtime/**`，不是 `/docs/pokopia_image_sources/**`。
- Given `validate:dist` 运行, when `dist/docs/pokopia_image_sources/**` 存在, then validation 非零失败。

### Story 4.2 - 生成优化后的 runtime image assets

Acceptance Criteria:

- Given raw Pokemon/item source images 存在, when asset generation 运行, then 仅为 runtime manifest allowlist 生成图片。
- Given Pokemon portrait 生成, then 最大边长不超过 420px，默认 WebP quality 82 或等价设置，单文件小于 64 KiB。
- Given item portrait 生成, then 最大边长不超过 240px，默认 WebP quality 82 或等价设置，单文件小于 32 KiB。
- Given generated runtime images, then 总体积小于 15 MiB，且所有引用 path 存在。
- Given raw image 存在透明背景或 WebP-behind-PNG, then 输出保持可见主体与透明/背景处理正确。

### Story 4.3 - 压缩 runtime recommendation/data contract

Acceptance Criteria:

- Given browser 已加载 runtime item index, when recommendation JSON 加载, then UI 可以用 `itemSlug` 解析 item 名称、图片、分类、可染色状态和 item 主色。
- Given recommendation entry 生成, then 不再重复存储可从 Pokemon index 或 item index 派生的字段。
- Given UI 展示推荐原因, then `matchedPreferenceTerms`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex` 等解释信息仍可展示或追踪。
- Given `validate:recommendations` 运行, then `dist/data/recommendations/**` raw 小于 12 MiB、gzip 小于 800 KiB、单文件 gzip 小于 5 KiB。
- Given compact runtime item data 生成, then gzip 小于 50 KiB；build-only traceability 不进入 runtime JSON。

### Story 4.4 - 建立 dist size budget 与部署校验 gate

Acceptance Criteria:

- Given `npm run build` 完成, when `validate:dist` 运行, then 计算 `dist` logical byte size 并要求小于 40 MiB。
- Given `dist` 包含 raw source manifests、raw source image directories、unexpected data files 或 local absolute paths, then validation 非零失败。
- Given SSG pages 生成, then 全部 311 个 `/pokemon/{slug}/index.html` 仍存在，且 static HTML 中图片 URL 指向 runtime asset path。
- Given Playwright smoke 直接访问 `/pokemon/ditto/`, then hydrate 后 Pokemon、推荐图片和 recommendation data 均使用 runtime distribution boundary。
```

## 6. Dist Size Budget

Proposed release budget:

| Area | Budget | Validation |
| --- | ---: | --- |
| `dist` logical bytes | <= 40 MiB | `validate:dist` recursively sums file sizes |
| `dist/docs/pokopia_image_sources` | must not exist | `validate:dist` path denylist |
| runtime Pokemon images | <= 8 MiB total, <= 64 KiB each | asset manifest + file stat |
| runtime item images | <= 7 MiB total, <= 32 KiB each | asset manifest + file stat |
| all runtime images | <= 15 MiB | asset manifest + file stat |
| `dist/data/recommendations` raw | <= 12 MiB | file stat |
| `dist/data/recommendations` gzip | <= 800 KiB total, <= 5 KiB per Pokemon | gzip validation |
| compact runtime item data gzip | <= 50 KiB | gzip validation |
| SSG pages | exactly 311 pages | existing SSG validation |

These numbers are realistic because current no-write estimates show runtime images can be around 8.95 MiB, and compacted recommendation JSON can be around 10.55 MiB raw / 0.62 MiB gzip.

## 7. Implementation Handoff

Recommended sequence:

1. Update PRD, architecture, project context, epics, and sprint-status for Epic 4.
2. Run `bmad-create-story` for Story 4.1, then `bmad-dev-story`.
3. Implement Story 4.1 and Story 4.2 together only if the same asset manifest/path rewrite touches the same files; otherwise keep them separate.
4. Run adversarial `bmad-code-review` before committing each story.
5. Implement Story 4.3 after image paths are stable, because recommendation JSON should point to the final runtime asset contract.
6. Implement Story 4.4 last and make `npm run build` the final release gate.
7. Final validation commands:
   - `npm run generate:data`
   - `npm run validate:data`
   - `npm run validate:recommendations`
   - `npm run build`
   - `git diff --check`

Expected primary files for implementation:

- `vite.config.ts`
- `scripts/generate-data.ts`
- `scripts/generate-ssg.ts`
- `scripts/validate-build.ts`
- `src/data/schemas.ts`
- `src/data/client.ts`
- `src/main.ts`
- `tests/smoke/pokemon-page.spec.ts`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## 8. Approval Gate

This proposal was approved by Grigri with `C` on 2026-05-14.

Continue options:

- Active PRD、architecture、project-context、epics/stories 和 sprint tracker 已按本 proposal 更新。
- Next workflow: `bmad-dev-story` for Story 4.1, followed by `bmad-code-review`, fixes, and commit before continuing to Story 4.2.
