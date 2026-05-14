---
title: "为当前系统增加 i18n 并冻结宝可梦名称展示规则"
type: "feature"
created: "2026-05-14"
status: "draft"
context:
  - "{project-root}/_bmad-output/project-context.md"
  - "{project-root}/_bmad-output/planning-artifacts/architecture.md"
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** 当前 SPA 与 SSG 静态页混用了中文、英文和硬编码文案；后续增加翻译时，宝可梦名称、推荐说明、筛选标签、可访问性文本和 SEO metadata 容易出现不一致。

**Approach:** 增加轻量 i18n 字典与格式化入口，覆盖当前用户可见文案、aria 文案、错误/空状态和 SSG metadata。宝可梦名称采用固定展示规则：只要有中文名，就显示 `中文 / English`；缺少中文名时显示英文名；其他条目按下方“待确认翻译清单”决定翻译或保留英文。

## Boundaries & Constraints

**Always:**
- 宝可梦名称在搜索列表、详情标题、浮动入口、图片 alt、SSG `<title>`、静态页 `<h1>`、推荐摘要和测试断言中统一使用 `zhName / name`；不得只显示中文名或英文名。
- 搜索仍必须匹配编号、英文名、中文名和 slug；i18n 不改变 canonical slug、URL、generated JSON 的结构或内部枚举值。
- i18n 只改变展示层。`category`、`tags`、`harmonyStatus`、`harmonyType`、`recommendedDyeColors` 等数据值继续作为稳定英文/枚举保存，筛选逻辑继续使用内部值。
- SPA 与 SSG 必须共享同一套展示文案策略，避免静态页与 hydrate 后页面文案不一致。
- 所有新增文案都需要转义后渲染，保持当前 XSS 防护习惯。

**Ask First:**
- 下方“待确认翻译清单”中的每一类，用户需要明确：翻译为中文、保留英文，或双语展示。未确认前不得进入实现。
- 如果用户要求翻译道具名称，需要先确认翻译数据来源；不能自动机器翻译 1219 个道具名。
- 如果用户要求翻译偏好词，需要确认是只翻译展示层，还是同时维护中英文检索别名。

**Never:**
- 不自动翻译源数据，不批量改写 `generated/data/**` 中的 canonical 英文枚举和值。
- 不改动 slug、静态路由、图片路径、推荐排序、颜色提取和 OKLCH 规则。
- 不引入大型运行时 i18n 框架，除非后续需求出现多语言路由、异步语言包或复杂复数规则。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 宝可梦有中文名 | `zhName="百变怪"`, `name="Ditto"` | 所有宝可梦名称位置显示 `百变怪 / Ditto` | 不回退为单语 |
| 宝可梦缺中文名 | `zhName=null`, `name="Mosslax"` | 显示 `Mosslax` | 不显示 `null / Mosslax` |
| 分类展示已翻译 | 内部 category 为 `Furniture`，展示标签为 `家具` | UI 展示 `家具`，筛选仍按 `Furniture` 命中 | 未知 category 显示 fallback 标签 |
| 条目标记保留英文 | 用户指定 `Pattern`, `OKLCH`, `Override` 保留英文 | 展示层原样输出英文 | 不混入自动中文 |
| SSG 与 hydrate | `/pokemon/ditto/` 静态 HTML hydrate | 静态 HTML 与 hydrate 后宝可梦名称、section 文案、推荐摘要一致 | smoke test 覆盖差异 |

</frozen-after-approval>

## Code Map

- `index.html` -- 首屏 HTML、品牌文案、搜索框 placeholder、aria-label、section 标题和筛选 option 的当前硬编码来源。
- `src/main.ts` -- SPA 展示核心；包含 item filter label、宝可梦名称、推荐状态、推荐卡片字段、分页、错误状态和启动失败文案。
- `src/app/pokemon-ui.ts` -- 搜索匹配与宝可梦 alt text；需要复用统一宝可梦展示名。
- `scripts/generate-ssg.ts` -- 静态详情页、SEO metadata、静态推荐摘要和恢复文案；需要与 SPA 共用展示策略。
- `src/data/schemas.ts` -- generated data 类型和内部枚举约束；应保持为数据契约，不承担展示翻译。
- `tests/smoke/pokemon-page.spec.ts` -- hydrate、筛选、分页和静态页断言；需要更新为 i18n 后的用户可见文案。
- `generated/data/pokemon-index.json` -- 宝可梦 `name` / `zhName` 来源；实现不应手改此文件。
- `generated/data/compact-items.json` -- 道具名称、分类、tags、偏好词来源；实现不应手改此文件。

## 待确认翻译清单

**A. 产品与区域标题**
- `Pokopia Decor Dex`
- `Pokopia / Decor Dex`
- `Pokopia Decor Dex - Color Palettes and Item Matches`
- `宝可梦头像色板、比例与家具搭配候选。`
- `Pokopia Decor Dex / Static Page`
- `Item Match`
- `搭配道具`

**B. 搜索、抽屉与导航**
- `当前宝可梦`
- `关闭搜索抽屉`
- `Search / 搜索`
- `搜索 Pokemon 名称、英文名或编号`
- `Pokemon list range`
- `Pokopia pokemon`
- `All`
- `001-120`
- `121+`
- `311 Pokemon`

**C. 色板、指标与静态页 section**
- `色板 / Swatches`
- `Pattern`
- `Primary color values`
- `Color pattern cells`
- `主色与色板`
- `HEX`
- `RGB`
- `CMYK`
- `Color Source`
- `Pattern Cells`
- `0 colors`
- `0 cells`
- `40 cells`
- `No.`

**D. 推荐面板状态与操作**
- `推荐搭配`
- `推荐搭配 · {filter}`
- `正在读取推荐搭配`
- `推荐搭配暂时不可用`
- `当前数据和规则暂未产生推荐搭配。可以切换 Pokemon，或稍后补充 override 后重新生成数据。`
- `当前筛选下没有推荐搭配。可以显示全部推荐或切换 Pokemon。`
- `{Pokemon}的匹配度较高道具`
- `当前规则只产生 {count} 个推荐搭配；结果基于现有数据和规则，可切换 Pokemon 继续比较。`
- `重新读取`
- `切换 Pokemon`
- `显示全部推荐`
- `推荐搭配分页`
- `上一页推荐搭配`
- `下一页推荐搭配`
- `上一页`
- `下一页`
- `第 {page} / {totalPages} 页`

**E. 推荐卡片字段**
- `分类`
- `可染色`
- `是`
- `否`
- `建议染色`
- `主色`
- `无`
- `OKLCH`
- `匹配依据`
- `数据页`
- `暂无明确染色`
- `通过`
- `染色备选`
- `不需要 OKLCH`
- `Override`
- `Analogous`
- `Complementary`
- `Split Complementary`
- `Triadic`
- `Monochrome`

**F. 筛选标签、分类与 tag 展示值**
- 当前筛选标签：`全部`、`家具`、`装饰`、`玩具`、`地块`、`食物`
- 当前数据分类/tag：`Furniture`、`Decoration`、`Toy`、`Blocks`、`Road`、`Food`、`Other`、`Misc.`、`Buildings`、`Utilities`、`Outdoor`、`Relaxation`、`Nature`、`Kits`、`Materials`、`Key Items`

**G. 偏好词与匹配依据词**
- `group activities`
- `lots of nature`
- `exercise`
- `dry flavors`
- `cute stuff`
- `bitter flavors`
- `sweet flavors`
- `spicy flavors`
- `watching stuff`
- `sour flavors`
- `lots of water`
- `strange stuff`
- `stone stuff`
- `lots of fire`
- `shiny stuff`
- `nice breezes`
- `soft stuff`
- `wooden stuff`
- `luxury`
- `cleanliness`
- `hard stuff`
- `containers`
- `metal stuff`
- `electronics`
- `round stuff`
- `fabric`
- `slender objects`
- `rides`
- `healing`
- `glass stuff`
- `pretty flowers`
- `lots of dirt`
- `spooky stuff`
- `ocean vibes`
- `colorful stuff`
- `complicated stuff`
- `construction`
- `wobbly stuff`
- `play spaces`
- `noisy stuff`
- `garbage`
- `gatherings`
- `looks like food`
- `symbols`
- `sharp stuff`
- `letters and words`
- `spinning stuff`
- `blocky stuff`

**H. 染色颜色名**
- `blue`
- `orange`
- `pink`
- `purple`
- `red`
- `white`
- `yellow`

**I. 路由、错误与恢复文案**
- `找不到 Pokemon`
- `ROUTE`
- `STATUS`
- `NOT FOUND`
- `RECOVERY`
- `SEARCH`
- `这个 slug 不在当前 generated data 中。`
- `未找到 {routeLabel}。请打开搜索选择其他 Pokemon。`
- `无法读取 Pokopia 生成数据`
- `请重新运行 npm run generate:data 后刷新页面。`
- `重新载入`
- SSG 恢复文案：`推荐数据文件缺失；重新生成数据后此页会自动展示搭配候选。`
- SSG 恢复文案：`推荐数据为空；补充偏好词或 override 后此页会自动展示搭配候选。`
- SSG 恢复文案：`推荐摘要来自当前 Pokemon 的 generated recommendation data。`

**J. 道具名称**
- 当前 generated data 有 1219 个 `item.name`，多数 `item.nameZh` 为空。需要用户决定：道具名称全部保留英文、后续提供中文表、还是只对推荐卡片中出现的道具补充中文。

## Tasks & Acceptance

**Execution:**
- [ ] `src/i18n/catalog.ts` -- 新增轻量字典和 `t(key, params)` / label map，先只实现用户已确认的翻译策略。
- [ ] `src/i18n/display.ts` -- 新增 `displayPokemonName({ zhName, name })`、`displayItemName(...)`、`displayCategory(...)`、`displayPreferenceTerm(...)` 等展示 helper，保证内部数据值与展示值分离。
- [ ] `index.html` -- 将首屏默认文案与 aria-label 对齐已确认的默认 locale；保留 hydrate 前可读内容。
- [ ] `src/main.ts` -- 用 i18n/helper 替换硬编码展示文案；保持搜索、筛选和推荐逻辑使用内部值。
- [ ] `src/app/pokemon-ui.ts` -- 复用宝可梦展示名/alt text helper，保证搜索 haystack 不回归。
- [ ] `scripts/generate-ssg.ts` -- 复用同一展示策略生成静态页、metadata 和推荐摘要。
- [ ] `tests/smoke/pokemon-page.spec.ts` -- 更新静态页、hydrate、筛选和分页断言；增加 `zhName=null` 的 helper 单测或 fixture 覆盖。

**Acceptance Criteria:**
- Given 宝可梦有中文名和英文名, when SPA 搜索列表、详情页、浮动入口和 SSG 静态页渲染, then 宝可梦名称都显示为 `中文 / English`。
- Given 宝可梦缺少中文名, when 任意宝可梦名称位置渲染, then 只显示英文名且没有多余分隔符。
- Given 某条非宝可梦文案被用户标记为保留英文, when SPA 与 SSG 渲染, then 该文案保持英文且不会被自动翻译。
- Given 分类/tag/偏好词被用户提供中文展示值, when 推荐卡片与筛选器渲染, then 用户看到中文展示值，但筛选与推荐仍基于原始英文内部值。
- Given 执行 `npm run build`, when 构建完成, then data validation、Vite build、SSG、dist validation 和 Playwright smoke 全部通过。

## Spec Change Log

## Design Notes

推荐实现为项目内轻量字典，而不是引入运行时框架。当前只有一个静态站点、一个默认语言目标和少量 formatter；用本地 catalog 可以让 SPA 与 SSG 共享同一套纯函数，同时避免语言包加载、路由 locale 和异步状态进入 MVP 范围。

建议字典以稳定 key 表达 UI 意图，例如 `recommendation.actions.retry`、`recommendation.fields.category`、`category.Furniture`。数据值继续保存英文内部值，展示时通过 map 查找；找不到翻译时按用户确认策略 fallback 为英文或原值。

## Verification

**Commands:**
- `npm run build` -- expected: data validation、recommendation fixtures、build validation、TypeScript、Vite、SSG、dist validation、Playwright smoke 全部成功。

**Manual checks:**
- 打开 `/pokemon/ditto/`，确认静态页和 hydrate 后宝可梦名称均为 `百变怪 / Ditto`，推荐摘要没有从双语名称退化为单语。
- 搜索 `ditto`、`百变怪`、`063` 都能命中同一宝可梦。
- 切换筛选标签后，展示标签符合用户确认的翻译策略，推荐数量与实现前一致。
