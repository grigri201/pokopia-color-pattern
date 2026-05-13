---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
lastStep: 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/project-context.md
  - index.html
workflowType: 'architecture'
project_name: 'pokopia-color-pattern'
user_name: 'Grigri'
date: '2026-05-13'
status: 'complete'
completedAt: '2026-05-13'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

PRD 定义了 48 条 FR，架构上可以归为七组：

- Pokemon 发现与详情页：支持稳定 `/pokemon/{slug}/`、当前 Pokemon 展示、搜索与切换、无 JS 核心可读。
- 色板与审美上下文：为 Pokemon 和推荐 item 提供主色、色板、色值文本和 OKLCH 和谐关系。
- Item 推荐：所有推荐先命中 Pokemon 偏好词；可染色 item 不要求主色和谐；不可染色 item 必须通过 OKLCH 和谐判定。
- 推荐浏览：每页 10 个 item，推荐卡片展示 item 图像、分类、偏好命中、可染色状态、主色和和谐状态。
- 分享与快速访问：每个 Pokemon 有唯一 title、description、推荐摘要，并在 hydrate 后保留现有 SPA 体验。
- 数据契约与生成：原始 Pokopia 数据只读，compact item data、Pokemon metadata、推荐数据和静态页面由编译期脚本生成。
- 验证与维护：schema 校验、fixture tests、311 个静态页断言、推荐解释字段和错误恢复路径。

**Non-Functional Requirements:**

- 性能：完整 `item_portraits/manifest.csv` 不再作为首屏运行时必需资源；compact item data gzip 小于 50KB；单个 Pokemon 推荐数据 gzip 小于 5KB。
- 静态访问：全部 311 个 Pokemon 必须有 `/pokemon/{slug}/` 静态页，无 JS 时保留 Pokemon 名称、图片、主色、色板和推荐摘要。
- 可访问性：目标为基础 WCAG 2.2 AA；色板提供文本色值；搜索、筛选、分页和推荐浏览支持键盘操作；图片 alt 行为明确。
- 数据正确性：同一输入和算法版本生成相同排序；推荐解释字段必须包含 `matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex`。
- 可维护性：schema 或等价结构校验必须覆盖 compact item manifest、Pokemon metadata override、推荐数据和 SSG 输出。
- 安全与隐私：不引入账号、支付或敏感数据；构建脚本不得把密钥、本地绝对路径或开发机私有信息写入前端产物。

**Scale & Complexity:**

- Primary domain: brownfield Web SPA + Hybrid SSG 静态目录。
- Complexity level: medium。项目没有后端、账号、实时协作或合规系统，但存在构建期数据管线、图片取色、推荐算法、SSG、hydrate 一致性和体积预算。
- Estimated architectural components: 8 个核心组件。
  1. 原始数据读取与 CSV/JSON 规范化。
  2. Pokemon metadata override 读取与合并。
  3. Pokemon/item 主色与色板生成。
  4. OKLCH 和谐判断与推荐引擎。
  5. compact runtime data 生成。
  6. `/pokemon/{slug}/` 静态 HTML 生成。
  7. SPA hydration、路由和 UI 渲染。
  8. schema、fixture、体积和浏览器 smoke validation。

### Technical Constraints & Dependencies

- 当前项目是 Vite + TypeScript + 原生 DOM 的 brownfield SPA，不迁移到 React、Vue、Next、Remix 或其他重型框架。
- 当前 `index.html` 是已确定 UX 的结构来源：左侧 Pokemon 搜索抽屉、中央 Pokemon 色板舞台、右侧搭配道具 inspector。
- `docs/oklch_color.ts` 是 OKLCH 方法论源头，推荐引擎只能复用或薄封装，不能另写不一致的色彩规则。
- `docs/pokopia_image_sources/item_portraits/manifest.csv` 是完整 1,219 个 in-collection item 的重数据源，不再由浏览器首屏直接读取。
- `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 包含 311 个 Pokemon portrait，是 SSG 页面的 Pokemon 范围来源。
- 原始 `docs/pokopia_image_sources/**` 数据只读；compact data、recommendation data 和 SSG HTML 都是派生产物。
- URL slug 使用小写 kebab-case，路径型 `/pokemon/{slug}/` 与当前 hash `#slug` 共享同一规范化逻辑。
- 资源路径必须同时支持根路径 SPA 和 `/pokemon/{slug}/` 子路径静态页，静态页脚本和图片引用不得依赖错误的相对路径。

### Cross-Cutting Concerns Identified

- Determinism: 排序 tie-breaker、字段顺序、文件写入顺序必须稳定，生成产物不能包含当前时间、随机数或本机路径。
- Data contract: 浏览器端只消费 compact schema 和单 Pokemon recommendation data，不再解析重 CSV。
- Hydration parity: 静态 HTML、hydrated SPA 和客户端导航必须展示同一个 slug、同一推荐排序和同一分页状态。
- Accessibility: 静态页与 hydrated 控件都要保留可读标签、键盘路径和图片 alt 策略。
- Performance budget: 体积校验是 build gate，不是人工检查项。
- Fallback visibility: 图片取色失败、override 缺失、slug 不存在、推荐为空都必须有可追踪 fallback 和可恢复 UI。
- Agent consistency: 多个实现 agent 不能各自发明数据目录、slug 规则、推荐字段或测试入口。

## Starter Template Evaluation

### Primary Technology Domain

本项目是 brownfield Vite + TypeScript Web SPA，并扩展为 Hybrid SSG。架构选择是继续使用现有项目作为 starter，而不是重新运行脚手架。

### Technical Preferences Found

- Language: TypeScript strict mode，ESM，`moduleResolution: "Bundler"`，`isolatedModules: true`。
- Frontend: 原生 DOM + 全局 CSS + Vite，不引入 React/Vue/Next。
- Build scripts: Node ESM scripts，可以使用 `node:fs`、`node:path` 等 Node API。
- Data: CSV/JSON 解析必须 deterministic，JSON 字段使用结构化解析。
- OKLCH: `docs/oklch_color.ts` 是色彩规则源头。
- Validation: 当前最低 gate 是 `npm run build`，新增测试工具必须轻量并接入 `package.json`。

### Starter Options Considered

**Option 1: Keep existing Vite vanilla TypeScript baseline, selected.**

- Matches current code and confirmed UX.
- Avoids unrelated framework migration.
- Lets implementation focus on data pipeline, recommendation engine and SSG.
- Requires adding build scripts, generated data serving, tests and SSG validation.

**Option 2: Recreate with `npm create vite@latest` vanilla-ts, rejected.**

- Useful for a greenfield reset, but this repo already has the correct Vite/TS baseline and established UI.
- Would risk losing current `index.html`, `src/main.ts`, `src/styles.css`, data copy behavior and BMAD context.

**Option 3: Move to Next/SvelteKit/Astro, rejected for this release.**

- Could provide route-based SSG, but PRD explicitly says not to make a heavy SSG framework the premise.
- It would create a framework migration story unrelated to the current MVP value.

### Selected Starter: Existing Brownfield Vite Vanilla TypeScript Project

**Rationale for Selection:**

The existing checkout already satisfies the architectural base: Vite, TypeScript, ESM, strict TS, root `index.html`, `src/main.ts`, `src/styles.css`, and a working static asset copy plugin. The architecture should add generation and validation around this baseline rather than replacing it.

**Initialization Command:**

```bash
# No new starter command. Use the existing checkout.
npm install
npm run build
```

If a future rebuild is ever needed, the closest equivalent starter is:

```bash
npm create vite@latest pokopia-color-pattern -- --template vanilla-ts
```

This command is not part of the current implementation plan.

### Version Verification

Versions checked on 2026-05-13:

- Current lockfile: Vite 7.3.3, TypeScript 5.9.3, `@types/node` 24.12.4.
- Current local runtime: Node 24.14.0, npm 11.12.1.
- Registry latest at check time: Vite 8.0.12, TypeScript 6.0.3, Vitest 4.1.6, `@playwright/test` 1.60.0.
- Decision: keep current locked Vite 7.3.3 and TypeScript 5.9.3 for this architecture. A major Vite/TypeScript upgrade is not required by the PRD and should not be mixed into the SSG/recommendation work unless a later dependency-maintenance story explicitly asks for it.

### Architectural Decisions Provided by Starter

**Language & Runtime:**

- TypeScript + ESM.
- Browser app cannot use Node-only APIs.
- Build scripts run under Node and can use Node APIs.

**Styling Solution:**

- Keep `src/styles.css` global CSS and CSS custom properties.
- Preserve the decided `index.html` structural UX.

**Build Tooling:**

- Vite remains the app bundler.
- `vite.config.ts` remains the integration point for dev serving and build-time asset copying.

**Testing Framework:**

- Add Vitest for TypeScript unit and fixture tests.
- Add Playwright only for browser smoke coverage required by PRD.

**Code Organization:**

- Keep the current single-page entry but split domain logic out of `src/main.ts` during implementation.
- Build-time generation lives in `scripts/` and shared pure logic lives in `src/domain/`.

**Development Experience:**

- `npm run dev` serves the hydrated SPA.
- `npm run generate` produces data needed by dev and build.
- `npm run build` must become the production gate: generate data, typecheck, Vite build, generate SSG pages, validate output.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Keep Vite + TypeScript +原生 DOM. No React/Vue/Next migration.
- Use a custom build-time data and SSG pipeline instead of runtime heavy CSV parsing.
- Treat `docs/pokopia_image_sources/**` as immutable source input.
- Generate compact runtime data and per-Pokemon recommendation data before the app relies on it.
- Use `/pokemon/{slug}/` pathname as the canonical direct-access route and keep hash `#slug` as compatibility navigation.
- Reuse `docs/oklch_color.ts` for OKLCH harmony.
- Add fixture/schema/build/smoke validation as package scripts.

**Important Decisions (Shape Architecture):**

- Use static JSON files as the browser data boundary instead of bundling all generated data into JavaScript.
- Use a Vite plugin or equivalent dev middleware to serve generated data from `/data/` during development and copy it to `dist/data/` during build.
- Generate static Pokemon pages after the Vite app build by reusing built asset references from `dist/index.html`.
- Use `sharp` as the build-time image decoder/color extraction dependency because the dataset contains PNG and WebP assets.
- Use `zod` for schemas and `csv-parse` for robust CSV parsing.
- Use Vitest for deterministic recommendation and data fixtures.
- Use Playwright for direct static page + hydrate smoke tests.

**Deferred Decisions (Post-MVP):**

- Hosting provider and deployment platform remain static-hosting agnostic.
- Advanced recommendation filters by color role, item type or override source are deferred by PRD.
- Curated override management UI is deferred; overrides are structured files and scripts only.
- Dependency major upgrades beyond current lockfile are deferred unless implementation finds a specific blocker.

### Data Architecture

**Data Source Boundary:**

- Source inputs:
  - `docs/pokopia_image_sources/pokemon_portraits/manifest.csv`
  - `docs/pokopia_image_sources/item_portraits/manifest.csv`
  - `docs/pokopia_image_sources/pokopiadex_placeable_items.json`
  - `docs/pokopia_image_sources/pokopiadex_placeable_items.csv`
  - `docs/oklch_color.ts`
- Maintainer input:
  - `data/overrides/pokemon-metadata.json`
- Generated runtime output:
  - `generated/data/pokemon-index.json`
  - `generated/data/compact-items.json`
  - `generated/data/recommendations/{slug}.json`
  - `generated/data/build-summary.json`
- Distribution output:
  - `dist/data/**`
  - `dist/pokemon/{slug}/index.html`

**Raw Data Rule:**

Raw Pokopia source files are read-only. Any correction to Pokemon primary color, palette, pattern or manually paired items must be represented in override data, never by mutating raw manifest rows.

**Schema Strategy:**

- Define schemas in `src/data/schemas.ts` and reuse them from Node scripts and browser code.
- Validate raw-to-normalized outputs, override files, compact item data, recommendation data and SSG assertions.
- Use camelCase JSON fields for generated data.
- Preserve source traceability with `sourcePath`, `sourceRowId`, `colorSource` and `overrideSource` where relevant.

**Generated Data Loading:**

- Browser code fetches `/data/pokemon-index.json` for the list and selected Pokemon metadata.
- Browser code fetches `/data/recommendations/{slug}.json` only for the current Pokemon.
- `compact-items.json` contains item display fields and compact lookup metadata, not full source manifest columns.
- Static HTML includes enough core content for no-JS readability and may embed a minimal `application/json` bootstrap payload for the selected slug, but hydrated code still treats `/data/` as the canonical runtime data source.

### Recommendation Architecture

**Candidate Rule:**

An item is a recommendation candidate only when it matches at least one Pokemon preference term, including terms from source data or metadata override. Items with no preference-term match are excluded.

**Dyeable Branch Rule:**

- If `isDyeable` is true and preference terms match, the item may enter recommendations without OKLCH color harmony.
- If `isDyeable` is false, the item must match preference terms and satisfy OKLCH harmony.

**OKLCH Rule:**

The recommendation engine imports or wraps `docs/oklch_color.ts` functions. It must not use RGB distance, HSL tone buckets or another color-nearness shortcut as the source of truth for harmony.

**Ranking Rule:**

Ranking is deterministic and must sort by explicit keys:

1. Override mode priority when applicable.
2. Preference match strength.
3. Dyeable branch status.
4. OKLCH harmony class and role fit for non-dyeable items.
5. Stable item slug tie-breaker.

**Required Recommendation Fields:**

Every recommended item includes:

- `itemSlug`
- `itemName`
- `itemZhName`
- `category`
- `image`
- `matchedPreferenceTerms`
- `isDyeable`
- `pokemonPrimaryColor`
- `itemPrimaryColor`
- `harmonyStatus`
- `harmonyType`
- `overrideSource`
- `rank`
- `pageIndex`

### Color Extraction Architecture

- Build-time image decoding uses `sharp` in Node scripts.
- Palette extraction ignores transparent pixels and near-white transparent background artifacts.
- Pokemon color fallback priority:
  1. Pokemon metadata override.
  2. Extracted dominant palette from local portrait image.
  3. Default neutral color plus empty palette with `colorSource: "fallback"`.
- Item color fallback records `colorSource: "fallback"` and must not silently pass as extracted color.
- Generated color output includes enough metadata for debugging: source image path, extraction status, fallback reason and palette list.

### Static Rendering & Hydration Architecture

**Route Strategy:**

- Canonical route: `/pokemon/{slug}/`.
- Legacy/current route: `/#slug`.
- Hydration order:
  1. Parse `location.pathname` for `/pokemon/{slug}/`.
  2. If no path slug, parse `location.hash`.
  3. If neither exists, use `ditto`.
- Client navigation may keep using hash initially, but static route parsing has priority.

**SSG Strategy:**

- Production build runs Vite first to produce bundled app assets.
- SSG script reads `dist/index.html`, generated Pokemon data and recommendation data.
- SSG script writes `dist/pokemon/{slug}/index.html` for all 311 Pokemon.
- Each static page includes unique title, description, Pokemon image, primary color, swatches and recommendation summary before JS loads.
- Asset URLs in static pages use root-absolute paths so nested `/pokemon/{slug}/` pages load CSS, JS, images and JSON correctly.

**Hydration Strategy:**

- Static HTML and hydrated SPA share the same generated data contract.
- The hydrated app must not render default Ditto and then jump to the route slug.
- Hydration should reuse existing DOM content where practical or replace it only after selected slug data is loaded.
- Direct access, hash navigation and in-app switching must converge on the same selected Pokemon state.

### Authentication & Security

- No authentication, authorization, user accounts, payments or personal data are in scope.
- No external API product surface is defined.
- Build scripts must not require secrets or write environment values to `dist`.
- Any user-visible string inserted via HTML uses `escapeHtml` or DOM text APIs.
- Generated files must not include local absolute paths, machine usernames or private filesystem details.
- Static hosting can add HTTP headers later, but the application architecture does not depend on server-side middleware.

### API & Communication Patterns

- There is no network API server.
- The browser consumes static JSON under `/data/`.
- JSON file contracts are the API boundary:
  - `GET /data/pokemon-index.json`
  - `GET /data/compact-items.json`
  - `GET /data/recommendations/{slug}.json`
- Missing JSON, unknown slug or parse failure returns a visible recoverable UI state and logs a concise diagnostic.
- No rate limiting, API auth, GraphQL or backend service boundary is needed.

### Frontend Architecture

- Split `src/main.ts` into focused modules:
  - router/slug parsing
  - data client
  - state model
  - renderers
  - DOM event binding
  - accessibility helpers
- Keep the current three-zone UX: Pokemon index drawer, selected Pokemon stage, item inspector.
- Keep CSS in global stylesheet with custom properties; do not add a component framework.
- State is a typed in-memory object, not a new global state library.
- Runtime palette extraction and runtime furniture scoring are removed from the browser path after generated data is available.
- Browser rendering should prefer DOM APIs or escaped templates for all manifest-derived text.

### Infrastructure & Deployment

- Output is static `dist/`.
- Hosting is any static host that can serve nested fallback routes and static files.
- Build gate:
  - generate data
  - typecheck
  - unit/fixture tests
  - Vite build
  - SSG generation
  - build assertions
  - browser smoke tests when available in CI
- CI can be introduced as a later workflow file, but all commands must first exist in `package.json`.

### Decision Impact Analysis

**Implementation Sequence:**

1. Add schemas, CSV parsing and slug/data utilities.
2. Add metadata override schema and fixture.
3. Add build-time color extraction and compact item generation.
4. Add recommendation engine with OKLCH adapter and fixture tests.
5. Add generated data serving/copying in Vite config.
6. Refactor SPA runtime to fetch generated data and preserve current UX.
7. Add SSG generator for `/pokemon/{slug}/`.
8. Add build validation and Playwright direct-access smoke test.

**Cross-Component Dependencies:**

- SSG depends on generated Pokemon metadata and recommendation data.
- Hydration depends on route parsing and generated data client.
- Recommendation depends on compact items, Pokemon metadata, override data and OKLCH adapter.
- Build validation depends on all generated outputs and final `dist`.
- Tests depend on fixtures, not the full live manifest, except for build assertions that intentionally validate the full 311/1,219 counts.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**

12 areas where AI agents could otherwise diverge: slug rules, JSON field naming, generated paths, recommendation sorting, override modes, color fallback, SSG output paths, static asset URLs, hydration selection, test fixture locations, schema ownership and error handling.

### Naming Patterns

**Database Naming Conventions:**

No database is used. Do not create database-style repositories, migrations or ORM abstractions.

**API Naming Conventions:**

- Static JSON paths are kebab-case or lowercase directory names.
- Pokemon detail route is `/pokemon/{slug}/`.
- Generated recommendation files use `{slug}.json`.
- JSON fields use camelCase.
- Slugs use lowercase kebab-case from the shared `slugifyPokemonName` function.

**Code Naming Conventions:**

- Type/interface names use PascalCase: `PokemonSummary`, `RecommendationEntry`, `CompactItem`.
- Functions and variables use camelCase: `generateRecommendations`, `parsePathSlug`.
- Script filenames use kebab-case: `generate-data.ts`, `generate-ssg.ts`, `validate-build.ts`.
- Test files use `*.test.ts`.
- Fixture files use kebab-case and describe behavior: `dyeable-preference-match.json`.

### Structure Patterns

**Project Organization:**

- `src/domain/` owns pure business logic reusable by app, scripts and tests.
- `src/data/` owns schemas and static JSON client contracts.
- `src/app/` owns browser state, routing and renderers.
- `scripts/` owns Node-only generation and validation.
- `tests/` owns fixture and smoke tests.
- `generated/` owns derived local build inputs and reports.
- `dist/` is final build output and is not source of truth.

**File Structure Patterns:**

- Do not add build-time logic to `src/main.ts`.
- Do not parse raw CSV in browser modules.
- Do not duplicate OKLCH formulas in multiple files.
- Do not write generated data into `docs/pokopia_image_sources/**`.
- Do not commit local or machine-specific generated files unless a later story explicitly chooses to commit deterministic generated data.

### Format Patterns

**Static JSON Formats:**

- Top-level generated JSON objects include `schemaVersion`.
- Lists use arrays sorted by stable keys.
- Optional missing source data uses `null`, not omitted fields, when consumers need to distinguish missing from not applicable.
- Errors and fallbacks are represented with structured fields such as `colorSource`, `fallbackReason` and `generationWarnings`.

**Recommendation Page Format:**

- `pageIndex` is zero-based in data.
- UI may display one-based page numbers.
- Each recommendation data file includes `pageSize: 10` and `totalPages`.

**Date/Time Format:**

- Generated runtime artifacts should avoid timestamps.
- Build reports may include a timestamp only if the report is not used as deterministic runtime data.

### Communication Patterns

**Event System Patterns:**

- No custom event bus.
- DOM event handlers call typed state/actions directly.
- Router changes flow through one selected Pokemon action.

**State Management Patterns:**

- Browser state is a typed plain object.
- Selected Pokemon state is the single source for current slug, page and filter.
- Derived UI such as result counts, active buttons and page controls is rendered from state, not stored separately.
- URL changes and UI clicks both go through the same `selectPokemonBySlug` path.

### Process Patterns

**Error Handling Patterns:**

- Build scripts aggregate validation errors and exit non-zero after printing actionable file/path details.
- Browser data loading errors show a recoverable message and keep search/navigation available if possible.
- Unknown slug renders a not-found state with a link back to the index and does not crash hydration.
- Color extraction fallback records `colorSource: "fallback"`.

**Loading State Patterns:**

- Static page core content is visible before JavaScript.
- Hydrated loading states only apply to incremental data such as recommendation page changes.
- Do not hide the whole app while fetching a single Pokemon recommendation file if static content is already available.

### Enforcement Guidelines

**All AI Agents MUST:**

- Read `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/project-context.md` and this architecture before implementation.
- Keep raw `docs/pokopia_image_sources/**` data read-only.
- Use shared slug, schema, OKLCH and recommendation utilities instead of reimplementing local variants.
- Keep `/pokemon/{slug}/` and `#slug` compatibility in the same route parser.
- Run the relevant generation and validation command before claiming completion.

**Pattern Enforcement:**

- TypeScript strict checks catch schema and import drift.
- Vitest fixture tests catch recommendation branch and override behavior drift.
- Build validation catches missing pages, oversized JSON, invalid generated contracts and no-JS static content gaps.
- Playwright smoke catches direct access and hydration mismatch.
- `git diff --check` catches trailing whitespace in generated markdown/CSV changes.

### Pattern Examples

**Good Examples:**

```ts
const slug = parsePokemonSlugFromLocation(location, DEFAULT_POKEMON);
const recommendation = await loadRecommendation(slug);
```

```json
{
  "schemaVersion": 1,
  "pokemonSlug": "ditto",
  "pageSize": 10,
  "recommendations": [
    {
      "itemSlug": "ditto-doll",
      "matchedPreferenceTerms": ["ditto"],
      "isDyeable": false,
      "harmonyStatus": "pass",
      "harmonyType": "analogous",
      "overrideSource": null,
      "rank": 1,
      "pageIndex": 0
    }
  ]
}
```

**Anti-Patterns:**

- Fetching `docs/pokopia_image_sources/item_portraits/manifest.csv` in `src/main.ts`.
- Computing recommendation order in the browser with ad hoc HSL/RGB distance.
- Generating `/pokemon/{slug}/` pages that contain only an empty app shell.
- Using relative `../assets/...` paths that break from nested static pages.
- Treating override replacement and override append as the same behavior.
- Adding a framework migration to solve SSG when a static Node script is sufficient.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
pokopia-color-pattern/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── _bmad-output/
│   ├── project-context.md
│   └── planning-artifacts/
│       ├── prd.md
│       ├── prd-validation-report.md
│       └── architecture.md
├── data/
│   └── overrides/
│       ├── pokemon-metadata.schema.json
│       └── pokemon-metadata.json
├── docs/
│   ├── oklch_color.ts
│   └── pokopia_image_sources/
│       ├── pokemon_portraits/
│       │   └── manifest.csv
│       ├── item_portraits/
│       │   └── manifest.csv
│       ├── pokopiadex_placeable_items.csv
│       ├── pokopiadex_placeable_items.json
│       └── summary.md
├── generated/
│   ├── data/
│   │   ├── pokemon-index.json
│   │   ├── compact-items.json
│   │   └── recommendations/
│   │       └── {slug}.json
│   ├── reports/
│   │   ├── generation-summary.json
│   │   └── build-validation.json
│   └── schemas/
│       ├── compact-item.schema.json
│       ├── pokemon-summary.schema.json
│       └── recommendation.schema.json
├── scripts/
│   ├── generate-data.ts
│   ├── generate-ssg.ts
│   ├── validate-build.ts
│   └── lib/
│       ├── csv.ts
│       ├── files.ts
│       ├── image-colors.ts
│       └── write-json.ts
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── app/
│   │   ├── boot.ts
│   │   ├── events.ts
│   │   ├── router.ts
│   │   ├── state.ts
│   │   └── render/
│   │       ├── drawer.ts
│   │       ├── inspector.ts
│   │       ├── pagination.ts
│   │       ├── stage.ts
│   │       └── swatches.ts
│   ├── data/
│   │   ├── client.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── domain/
│   │   ├── color-harmony.ts
│   │   ├── compact-items.ts
│   │   ├── pokemon-metadata.ts
│   │   ├── recommendation.ts
│   │   └── slug.ts
│   └── utils/
│       ├── dom.ts
│       └── escape-html.ts
├── tests/
│   ├── fixtures/
│   │   ├── compact-items.fixture.json
│   │   ├── pokemon-overrides.fixture.json
│   │   └── recommendations.fixture.json
│   ├── unit/
│   │   ├── color-harmony.test.ts
│   │   ├── recommendation.test.ts
│   │   ├── schemas.test.ts
│   │   └── slug.test.ts
│   └── smoke/
│       └── pokemon-page.spec.ts
└── dist/
    ├── index.html
    ├── assets/
    ├── data/
    └── pokemon/
        └── {slug}/
            └── index.html
```

### Architectural Boundaries

**API Boundaries:**

- Static JSON files under `/data/` are the only runtime data API.
- Browser code never reads raw CSV or raw PokopiaDex JSON.
- Build scripts may read raw docs and overrides.

**Component Boundaries:**

- `src/domain/` is pure and browser-safe unless a file is explicitly under `scripts/lib`.
- `src/app/` owns DOM and browser events.
- `scripts/` owns filesystem, image decoding and SSG writes.
- `docs/oklch_color.ts` remains the OKLCH method source and is accessed through `src/domain/color-harmony.ts`.

**Service Boundaries:**

- No long-running backend services.
- Build-time scripts are command services with file inputs and file outputs.
- Vite dev server is only for development and does not become an application backend.

**Data Boundaries:**

- Raw data boundary: `docs/pokopia_image_sources/**`.
- Maintainer override boundary: `data/overrides/**`.
- Generated data boundary: `generated/data/**`.
- Runtime distribution boundary: `dist/data/**`.

### Requirements to Structure Mapping

**Pokemon Discovery and Detail Pages (FR1-FR6):**

- `src/app/router.ts`
- `src/app/render/stage.ts`
- `src/app/render/drawer.ts`
- `scripts/generate-ssg.ts`
- `dist/pokemon/{slug}/index.html`

**Color Palette and Aesthetic Context (FR7-FR11):**

- `scripts/lib/image-colors.ts`
- `src/domain/color-harmony.ts`
- `src/domain/pokemon-metadata.ts`
- `generated/data/pokemon-index.json`

**Item Recommendation (FR12-FR20):**

- `src/domain/recommendation.ts`
- `src/domain/compact-items.ts`
- `generated/data/recommendations/{slug}.json`
- `tests/unit/recommendation.test.ts`

**Recommendation Browsing (FR21-FR25):**

- `src/app/render/inspector.ts`
- `src/app/render/pagination.ts`
- `src/data/client.ts`
- `src/app/state.ts`

**Sharing and Fast Access (FR26-FR30):**

- `scripts/generate-ssg.ts`
- `src/app/router.ts`
- `tests/smoke/pokemon-page.spec.ts`

**Data Contract and Generation (FR31-FR40):**

- `src/data/schemas.ts`
- `data/overrides/pokemon-metadata.json`
- `scripts/generate-data.ts`
- `generated/schemas/**`

**Validation and Maintenance (FR41-FR48):**

- `scripts/validate-build.ts`
- `tests/unit/*.test.ts`
- `tests/smoke/pokemon-page.spec.ts`
- `generated/reports/**`

### Integration Points

**Internal Communication:**

- Build scripts import shared domain/schema modules.
- Browser app imports schema types and fetches generated JSON.
- SSG script reads generated JSON and writes static HTML.

**External Integrations:**

- None at runtime.
- Existing source URLs are historical/source metadata only; production app uses local assets and generated data.

**Data Flow:**

```text
docs raw manifests + local images + metadata overrides
-> generate-data.ts
-> generated/data + generated/schemas + generation report
-> vite build
-> generate-ssg.ts
-> dist/index.html + dist/data + dist/pokemon/{slug}/index.html
-> validate-build.ts + Vitest + Playwright smoke
```

### File Organization Patterns

**Configuration Files:**

- Keep root `package.json`, `tsconfig.json`, `vite.config.ts`.
- Add test config only if needed by Vitest or Playwright.
- Do not edit `_bmad/config.user.toml` for project architecture.

**Source Organization:**

- `src/main.ts` becomes a thin boot entry.
- Rendering code lives by UI area.
- Domain code is framework-free and testable.

**Test Organization:**

- Unit and fixture tests in `tests/unit/`.
- Browser smoke tests in `tests/smoke/`.
- Test fixtures in `tests/fixtures/`.

**Asset Organization:**

- Original images stay under `docs/pokopia_image_sources/**`.
- Runtime generated data uses `/data/` in `dist`.
- Static pages are written under `dist/pokemon/{slug}/`.

### Development Workflow Integration

**Development Server Structure:**

- `npm run generate` creates `generated/data/**`.
- `npm run dev` serves the app and generated data.
- Vite dev middleware maps `/data/` to `generated/data/`.

**Build Process Structure:**

- `npm run build` runs generation, tests, typecheck, Vite build, SSG generation and validation in that order.
- `vite.config.ts` continues copying required docs/assets and also copies/serves generated `/data/`.

**Deployment Structure:**

- Deploy only `dist/`.
- Static host must serve nested `/pokemon/{slug}/index.html` paths and `/data/**`.
- No server runtime is required.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**

All decisions align with the PRD and current checkout. Vite + TypeScript +原生 DOM supports the existing UI, while custom Node scripts handle data generation and SSG without introducing a new framework. Static JSON files provide a clean runtime boundary and avoid bundling heavy manifest data.

**Pattern Consistency:**

Naming, route, JSON and generated-path patterns all use one slug/data contract. The same schema modules support generation, browser loading and validation. OKLCH logic has one source through `docs/oklch_color.ts`.

**Structure Alignment:**

The proposed structure separates raw data, overrides, generated data, browser app, domain logic, scripts and tests. This supports multi-agent implementation because each story can own a clear module boundary.

### Requirements Coverage Validation

**Epic/Feature Coverage:**

No epics have been generated yet. Feature coverage is mapped directly from PRD FR categories and is ready for `bmad-create-epics-and-stories`.

**Functional Requirements Coverage:**

- FR1-FR6: covered by route parser, SSG pages and stage/drawer renderers.
- FR7-FR11: covered by build-time color extraction and OKLCH adapter.
- FR12-FR20: covered by recommendation engine and required explanation fields.
- FR21-FR25: covered by inspector, pagination and generated recommendation pages.
- FR26-FR30: covered by static route generation, metadata and hydration priority.
- FR31-FR40: covered by schemas, overrides and data generation scripts.
- FR41-FR48: covered by validation scripts, fixtures and smoke tests.

**Non-Functional Requirements Coverage:**

- NFR1-NFR5: compact data and build size checks address performance.
- NFR6-NFR9: alt, labels, keyboard controls and visible color values are explicit UI constraints.
- NFR10-NFR13: SSG generator and route hydration rules address static access and shareability.
- NFR14-NFR18: deterministic sorting, recommendation fields and color fallback are architectural rules.
- NFR19-NFR26: schemas, fixture tests, output assertions and production build command are part of build gate.
- NFR27-NFR29: static-only no-secret/no-private-path rules address security and privacy.

### Implementation Readiness Validation

**Decision Completeness:**

Critical stack, data boundary, recommendation rules, route strategy, SSG strategy, validation strategy and testing tools are documented. Version checks were performed for current stack and likely new validation dependencies.

**Structure Completeness:**

The document defines source, data, generated, script, test and dist locations with a concrete project tree. It maps each FR category to modules and files.

**Pattern Completeness:**

The document defines naming, JSON format, slug handling, generated path, state, error, loading, fallback and enforcement rules.

### Gap Analysis Results

**Critical Gaps:**

None.

**Important Gaps:**

- Epics and stories do not exist yet. This is expected because architecture precedes `bmad-create-epics-and-stories`.
- Exact install versions for new dev dependencies should be pinned by the first implementation story using current registry values at implementation time.

**Nice-to-Have Gaps:**

- Static hosting provider, CI provider and advanced sharing card polish can be decided later.
- Advanced filter UI and curated override management UI remain post-release opportunities.

### Validation Issues Addressed

- Avoided framework migration despite SSG requirement by choosing custom static generation on top of Vite.
- Avoided runtime full-manifest loading by defining generated `/data/` contracts.
- Avoided inconsistent color logic by making `docs/oklch_color.ts` the OKLCH source.
- Avoided hydration mismatch by making pathname slug parsing higher priority than hash fallback.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high

**Key Strengths:**

- Architecture preserves the existing UX and stack while solving the PRD's performance and shareability requirements.
- Data and recommendation boundaries are explicit enough for multiple implementation agents.
- Validation is tied directly to measurable PRD NFRs.
- Recommendation rules preserve the product distinction: preference-first, dyeable exemption, OKLCH harmony for non-dyeable items.

**Areas for Future Enhancement:**

- Add social card image generation after core SSG is stable.
- Add advanced recommendation filtering after initial recommendation correctness is proven.
- Consider dependency major upgrades only after the MVP build gate is stable.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect source/generated/runtime data boundaries.
- Refer to this document for architecture questions before changing data paths, route behavior, recommendation rules or validation gates.

**First Implementation Priority:**

Run `bmad-create-epics-and-stories` next to convert the PRD and this architecture into implementable epics and stories. Story 1 should establish generation/test/build infrastructure before changing the visible SPA behavior.
