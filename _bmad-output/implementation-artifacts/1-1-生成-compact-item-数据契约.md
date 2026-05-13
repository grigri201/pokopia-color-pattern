# Story 1.1: 生成 compact item 数据契约

Status: ready-for-dev

## Story

As a 维护者,
I want 从原始 Pokopia item manifest 生成精简、可校验的 compact item 数据,
so that 前端和后续推荐逻辑可以使用稳定小体积数据，而不读取完整重 CSV。

## Acceptance Criteria

1. Given `docs/pokopia_image_sources/item_portraits/manifest.csv` 和相关 placeable item 源数据存在, when 维护者运行数据生成命令, then 系统生成 `generated/data/compact-items.json`, and 输出包含 `schemaVersion`、稳定排序的 item 列表、slug、名称、分类、tags、图片路径、source traceability 和推荐所需基础字段。
2. Given compact item 数据已生成, when schema 校验运行, then compact item 数据符合定义的 schema 或等价结构校验, and JSON 字段使用 camelCase，缺失但有语义的字段用 `null` 表达。
3. Given 原始 Pokopia 数据源位于 `docs/pokopia_image_sources/**`, when 数据生成命令完成, then 原始数据源未被修改, and 生成产物不写入 raw source 目录。

## Tasks / Subtasks

- [ ] 建立 compact item 数据契约与类型 (AC: 1, 2)
  - [ ] 在 `src/data/schemas.ts` 或等价位置定义 `CompactItem`、顶层 `schemaVersion` 和校验函数。
  - [ ] 字段使用 camelCase；必须包含 item slug、英文名/中文名、category、tags、image path、source traceability、推荐基础字段和可染色占位字段。
  - [ ] 对缺失但有语义的字段使用 `null`，不要省略字段造成消费者分支不明确。
- [ ] 实现 build-time compact item 生成入口 (AC: 1, 3)
  - [ ] 新增 `scripts/generate-data.ts` 和必要的 `scripts/lib/csv.ts`、`scripts/lib/write-json.ts`。
  - [ ] 从 `docs/pokopia_image_sources/item_portraits/manifest.csv`、`pokopiadex_placeable_items.csv/json` 读取原始数据，只读处理，不写回 `docs/pokopia_image_sources/**`。
  - [ ] 输出 `generated/data/compact-items.json`，排序以稳定 slug 或 source index 为 tie-breaker。
- [ ] 增加结构校验与命令 (AC: 2)
  - [ ] 在 `package.json` 添加生成/校验脚本，例如 `generate` 或 `validate:data`，命名需与后续 story build gate 兼容。
  - [ ] 校验失败时打印具体文件路径、字段名和 item slug/source row。
- [ ] 防止首屏继续依赖重 manifest (AC: 1)
  - [ ] 标记 `src/main.ts` 中现有 `ITEM_MANIFEST` 读取为后续 Story 1.3 的迁移目标，不在本故事中扩大 UI 重构。
  - [ ] 确认 compact 数据字段足以支持当前 item inspector 和后续推荐 UI。

## Dev Notes

- 当前项目是 Vite + TypeScript + 原生 DOM brownfield SPA，`package.json` 使用 ESM，`npm run build` 当前只执行 `tsc --noEmit && vite build`。
- 当前 `src/main.ts` 首屏同时 fetch `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 和 `docs/pokopia_image_sources/item_portraits/manifest.csv`；本故事先建立 compact data contract，后续 Story 1.3 再移除浏览器首屏重 CSV 读取。
- Raw data boundary: `docs/pokopia_image_sources/**` 是只读输入。生成数据写入 `generated/data/**`，最终分发由后续 build/SSG story 复制到 `dist/data/**`。
- CSV manifest 字段中可能包含 JSON 字符串数组，例如 `tags`、`sources`、`favorite_category_ids`；解析必须使用结构化 JSON parse，并保留失败分支。
- `docs/pokopia_image_sources/decorative_item_images.csv` 是较窄装饰集，不能误认为完整 placeable item 数据。完整 in-collection item 源以 `item_portraits/manifest.csv` 和 PokopiaDex placeable item 文件为准。
- JSON 生成必须 deterministic：稳定排序、稳定字段顺序，不写入当前时间、随机数、本机绝对路径或开发机用户名。
- 浏览器端不得依赖 Node-only API；Node 生成脚本可以使用 `node:fs`、`node:path` 等内置模块。

### Project Structure Notes

- 预期新增或后续使用的路径：`src/data/schemas.ts`、`src/domain/compact-items.ts`、`scripts/generate-data.ts`、`scripts/lib/csv.ts`、`scripts/lib/write-json.ts`、`generated/data/compact-items.json`。
- 不要把 build-time 解析逻辑塞进 `src/main.ts`；`src/main.ts` 应逐步变成 thin boot entry。
- 不要把生成产物写入 `docs/pokopia_image_sources/**`。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Data Contract and Generation, NFR1/NFR2/NFR19/NFR21]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Data Architecture, Project Structure & Boundaries]
- [Source: `_bmad-output/project-context.md` - Critical Implementation Rules, Critical Don't-Miss Rules]
- [Source: `src/main.ts` - current `ITEM_MANIFEST` runtime fetch]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
