---
title: '按宝可梦体型筛选家具尺寸推荐'
type: 'feature'
created: '2026-05-18'
status: 'draft'
context:
  - "{project-root}/_bmad-output/project-context.md"
  - "{project-root}/_bmad-output/planning-artifacts/prd.md"
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** 当前推荐管线只按 Pokemon 偏好词、可染色状态和 OKLCH 色彩和谐筛选 item；本地 Pokemon 数据没有 Pokopia 原生的小体型/大体型字段，因此大体型 Pokemon 可能被推荐会在游戏中提示“太小”的椅子、凳子或小床。

**Approach:** 增加一个 Pokopia 语义的体型/家具尺寸层：先查 Pokopia 对“medium-sized Pokémon or smaller”、den 可入住、床/relaxation item 太小提示的区分，再把实测或资料站证据固化为本地 source JSON；推荐候选在既有偏好词和颜色筛选之外增加尺寸兼容过滤，大体型 Pokemon 只保留大型家具，小体型 Pokemon 同时保留大型和小型家具。

## Boundaries & Constraints

**Always:**
- 构建和页面运行必须继续只消费 repo 内的 JSON/CSV；互联网抓取只能用于显式 fetch/seed 脚本，不能成为 `npm run build`、SSG 或浏览器运行时依赖。
- 保留现有推荐顺序：偏好词命中仍是第一道门；可染色 item 仍不要求主色和谐；不可染色 item 仍要求 OKLCH 和谐；overrides 仍叠加在自动推荐之后。
- Pokemon 体型不得由标准 Pokedex `height` / `weight` 推断。体型只来自 Pokopia 证据：den 是否可入住、是否会对一格床/椅子/relaxation item 报太小、或资料站/实测表中等价的 Pokopia 可用性记录。
- 体型字段使用 `pokopiaBodySize: "small" | "large" | "unknown"`。这里的 `small` 表示“Pokopia 中 medium-sized or smaller / 可用小型家具”的推荐语义，不代表传统 Pokedex 身高。
- 家具尺寸只应用到家具/居家相关 relaxation surface，不影响 food/material/block/decoration 等非家具推荐。`unknown` 家具尺寸不得让大体型 Pokemon 误配小家具：大体型只允许 `large`；小体型允许 `large`、`small` 和 `unknown`。
- 家具尺寸规则必须可追踪：优先使用 repo 本地 PokopiaDex item 描述和 `habitat_item_category_ids`，例如 den kit 的 `medium-sized Pokémon or smaller`、`straw-stool` / `plain-stool` 的 small Pokemon 描述、`poke-ball-bed` / `industrial-bed` 的 large Pokemon 描述、`1339` wide seats、`1435` large tables；缺失时再用资料站列表或实测记录补充。
- 推荐 diagnostics 必须记录被尺寸过滤的候选数量和样本，方便验证规则是否过严。

**Ask First:**
- 如果实现时发现 Pokopia 官方/社区存在比 den/床可用性更直接的隐藏体型分组，需要暂停确认是否替换数据源。
- 如果某个 item 同时匹配大型和小型规则且无法从名称/分类/外部列表判断，先加入显式 override；不要靠排序偶然决定。

**Never:**
- 不要把 `docs/pokopia_image_sources/**` raw 数据重新复制进 `dist`。
- 不要用运行时网络请求、浏览器抓网页或不稳定 DOM 解析来生成生产推荐。
- 不要用模糊字符串匹配替代显式规则表；运行时只能消费已经生成并校验过的规范化字段。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Large Pokemon | source marks `charizard` as refused den / needs large relaxation item; candidate `plain-chair` marked `small` | `plain-chair` is excluded before ranking; diagnostics records `furniture_size_mismatch` | No build failure; exclusion visible in report |
| Small Pokemon | source marks `ditto` as medium-or-smaller / small-compatible; candidates include `plain-chair` and `poke-ball-bed` | Both small and large furniture remain eligible if existing preference/color rules pass | Existing ranking decides final order |
| Missing Pokemon size | no Pokopia den/bed/use evidence for a local slug | Pokemon `pokopiaBodySize` becomes `unknown`; existing recommendation behavior remains except diagnostics records missing body-size evidence | Build fails only if missing count exceeds an explicit fixture threshold |
| Ambiguous furniture size | item name has conflicting large/small signals | generated metadata uses override value and records override source | Build fails if ambiguity has no override |

</frozen-after-approval>

## Code Map

- `docs/pokopia_image_sources/pokopiadex_pokemon_preferences.json` -- existing 311-Pokemon source lacks Pokopia body-size evidence and remains only the preference source.
- `docs/pokopia_image_sources/pokopiadex_placeable_items.json` -- existing 1,219-item source has useful Pokopia furniture/kit descriptions and `habitat_item_category_ids` for deterministic furniture-size derivation.
- `scripts/fetch-pokopiadex-preferences.ts` -- model for one-off internet-backed source seeding; add a separate size fetch/normalize script instead of changing build.
- `scripts/generate-data.ts` -- central place to join local sources into `compact-items`, `pokemon-index`, diagnostics, and recommendation files.
- `src/data/schemas.ts` -- schema versions and validators for new body/furniture size fields.
- `src/domain/recommendation.ts` and `src/domain/recommendation-data.ts` -- add size compatibility filtering and diagnostics without breaking existing color/preference rules.
- `scripts/validate-recommendation-fixtures.ts` and `scripts/validate-build.ts` -- fixture and build-level guards for size filtering, schema stability, and budgets.

## Tasks & Acceptance

**Execution:**
- [ ] `docs/pokopia_image_sources/pokopia_pokemon_body_sizes.json` and `scripts/fetch-pokopia-pokemon-body-sizes.ts` -- add a deterministic local Pokemon body-size source seeded from Pokopia den/bed/use evidence, not height/weight; primary candidate is the community den-fit sheet linked from the Reddit size thread, with `Yes -> small`, `No -> large`, and `Unchecked -> unknown` -- build must not depend on live internet.
- [ ] `docs/pokopia_image_sources/furniture_size_rules.json` -- add explicit large/small/override rules with source notes for local PokopiaDex descriptions, `1339` wide seats, `1435` large tables, and bed/stool descriptions.
- [ ] `scripts/generate-data.ts` -- join Pokemon body-size and furniture-size metadata into generated data; classify Pokemon as `small`/`large`/`unknown` and furniture as `large`/`small`/`unknown`.
- [ ] `src/data/schemas.ts` -- bump affected schema versions and validate new fields, summaries, and diagnostics without allowing unknown keys.
- [ ] `src/domain/recommendation.ts` and `src/domain/recommendation-data.ts` -- filter size-incompatible furniture candidates before ranking; preserve existing preference/color/dye/override ordering.
- [ ] `scripts/validate-recommendation-fixtures.ts` -- cover large Pokemon excluding small furniture, small Pokemon accepting both sizes, unknown size behavior, and ambiguous item override.
- [ ] `scripts/validate-build.ts` -- validate generated size metadata coverage and ensure runtime size budgets still pass.

**Acceptance Criteria:**
- Given a large Pokemon with matched preference terms, when candidate furniture is marked `small`, then the generated recommendations exclude that item and diagnostics report a size mismatch.
- Given a small Pokemon with matched preference terms, when candidate furniture includes both `small` and `large`, then both remain eligible for normal ranking.
- Given a non-furniture item, when generating recommendations for any Pokemon body size, then the size filter does not exclude it.
- Given missing or ambiguous source data, when running `npm run generate:data`, then missing Pokopia body-size evidence is diagnosed and ambiguous furniture sizes require an explicit override.
- Given the full build, when running `npm run build`, then schema validation, recommendation fixtures, SSG, and dist budget checks pass.

## Spec Change Log

## Design Notes

数据站检查结论：截至 2026-05-18，未找到官方或主流资料站提供逐 Pokemon 的 Pokopia 体型枚举字段。Serebii 的 Pokemon 页只有标准身高/体重、属性、specialty、favorite 和 habitat；WikiPokopia、Pokopia World、Pokopia.dev、pokop.io、PokopiaDb、pokemonpokopia.org 也主要暴露身高/体重、属性、specialty、稀有度、栖息地、喜好或物品分类，没有 `small` / `large` / `denSize` 这类可直接消费的 Pokemon 体型列。Serebii 的 building kit 页有 den kit 的可入住描述、`Liveable Pokemon` 和 building `Size`，可以作为家具/建筑规则证据，但不是逐 Pokemon 体型表。

当前最可用的外部体型来源是 Reddit size thread 中整理的 Google Sheet：列名包含 `Do they fit in a den?!`，抓取 CSV 后有 301 条 Pokemon 行，其中 `Yes` 46、`No` 16、`Unchecked` 239。实现时只能把 `Yes` / `No` 固化为 `pokopiaBodySize`，`Unchecked` 必须保持 `unknown` 并进入 diagnostics。该表同时证明不能用标准身高/体重推断体型：例如 Blastoise 和 Slowbro 都是 1.6m，但 den-fit 结果分别是 `No` 和 `Yes`。

本地检查结论：当前 repo 没有 Pokemon 体型字段，但已有 Pokopia 家具尺寸线索。`pokopiadex_placeable_items.json` / CSV 中四种 den kit 写明 `medium-sized Pokémon or smaller`；`straw-stool` 和 `plain-stool` 明确指向 small Pokémon；`poke-ball-bed` 和 `industrial-bed` 明确支持 large Pokémon；`habitat_item_category_ids` 中 `1339` 对应 wide seats，`1435` 对应 large tables。外部调研也支持“不是身高体重阈值”的判断：社区实测反馈同样身高附近的 Pokemon den 结果不一致，并把判断锚定到 den 可入住或小床/relaxation item 是否报太小。

尺寸兼容的最小规则：

```ts
largePokemon -> furnitureSize === "large"
smallPokemon -> furnitureSize === "large" || furnitureSize === "small" || furnitureSize === "unknown"
nonFurniture -> true
```

## Verification

**Commands:**
- `npm run generate:data` -- expected: generated compact data, pokemon index, recommendation diagnostics, and recommendation files include size-aware output with no generation issues.
- `npm run validate:recommendations` -- expected: fixture coverage passes for size-compatible and size-incompatible cases.
- `npm run build` -- expected: full deployment gate remains green and raw docs stay outside `dist`.
- `git diff --check` -- expected: no whitespace errors in source, specs, or generated artifacts.
