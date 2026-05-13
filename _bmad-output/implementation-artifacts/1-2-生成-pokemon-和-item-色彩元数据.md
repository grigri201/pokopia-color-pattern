# Story 1.2: 生成 Pokemon 和 item 色彩元数据

Status: done

## Story

As a 用户,
I want Pokemon 详情页展示稳定的主色、色板和 item 主色基础数据,
so that 我可以理解搭配体验的色彩依据。

## Acceptance Criteria

1. Given Pokemon 和 item 本地图片资源存在, when 维护者运行数据生成命令, then 系统为全部 Pokemon 生成主色和多色色板数据, and 系统为参与推荐的 item 生成主色数据。
2. Given 图片存在透明背景、WebP 或取色失败场景, when 颜色提取运行, then 提取逻辑忽略透明像素和近白背景噪声, and 失败时记录 `colorSource: "fallback"` 与可追踪 fallback 原因，不让页面空白或构建静默生成坏数据。
3. Given Pokemon 主色或色板需要人工修正, when override 数据提供对应字段, then Pokemon metadata 生成优先使用 override, and override 数据本身通过 schema 或等价结构校验。

## Tasks / Subtasks

- [x] 生成 Pokemon 色彩 metadata (AC: 1, 2, 3)
  - [x] 从 `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 读取全部 311 个 Pokemon。
  - [x] 生成 `generated/data/pokemon-index.json`，包含 slug、sequence、name、zhName、image、primaryColor、palette、colorSource 和 fallback reason。
  - [x] 对透明背景和近白背景噪声做过滤，失败时写入 fallback 而不是抛出空白结果。
- [x] 为参与推荐的 item 生成主色基础字段 (AC: 1, 2)
  - [x] 在 compact item 或配套 metadata 中补充 `itemPrimaryColor`、`colorSource`、`fallbackReason`。
  - [x] 处理 PNG/WebP 输入，不依赖 URL 后缀判断图片真实格式。
- [x] 建立 Pokemon metadata override schema (AC: 3)
  - [x] 新增 `data/overrides/pokemon-metadata.json` 和 schema/校验逻辑，支持 primary color、palette、pattern 字段。
  - [x] override 优先级高于自动取色，并在生成结果记录 override 来源。
- [x] 增加 fixture 或单元校验 (AC: 2, 3)
  - [x] 覆盖透明像素、近白背景、取色失败 fallback、override 覆盖主色和色板。
  - [x] 校验生成数据不包含本机绝对路径或开发机私有信息。

### Review Findings

- [x] [Review][Patch] 无效 Pokemon metadata override 必须报错，不能静默降级为空 override。
- [x] [Review][Patch] Pokemon 和 item color summary fallback/override 计数必须与实际条目重算结果一致。
- [x] [Review][Patch] item color 产物数量必须硬性锁定 1,219，避免 compact 与 color 数据一起缩水仍通过。
- [x] [Review][Patch] Pokemon slug 应优先使用源数据/filename 的 canonical slug，缺失时才 fallback 到 name slugify。
- [x] [Review][Patch] 图片取色聚类合并必须使用合并前 count 做加权平均，避免主色偏移。
- [x] [Review][Patch] item-colors 和 pokemon-index 需要 gzip 预算校验。
- [x] [Review][Patch] Pokemon sequence 必须校验为数字，避免排序退化。
- [x] [Review][Patch] override palette 百分比需要补齐到 100。
- [x] [Review][Patch] 增加 override primaryColor、palette、pattern 的 fixture 校验。

## Dev Notes

- 当前 `src/main.ts` 在浏览器运行时使用 canvas 从 Pokemon 图像提取色板；架构要求主色和色板逐步迁移到 build-time 生成，浏览器读取 generated metadata。
- 架构建议 build-time image decoding 使用 `sharp`，但新增依赖应由实现 story 根据当前 registry/lockfile谨慎 pin，避免把 Vite/TypeScript major upgrade 混入本故事。
- Pokemon color fallback 优先级：metadata override、portrait 提取主色、默认中性色和空色板，并记录 `colorSource: "fallback"`。
- Item color fallback 必须显式记录 fallback，不得伪装成提取成功。
- `docs/oklch_color.ts` 是后续 OKLCH 方法论源头；本故事只产出颜色数据，不另写推荐和谐规则。
- 生成文件必须保持稳定排序和字段顺序，不写当前时间或随机值。

### Project Structure Notes

- 预期路径：`data/overrides/pokemon-metadata.json`、`src/domain/pokemon-metadata.ts`、`scripts/lib/image-colors.ts`、`generated/data/pokemon-index.json`。
- Node-only 图片处理留在 `scripts/**`；浏览器 `src/**` 只消费生成后的 JSON。
- `docs/pokopia_image_sources/**` 继续作为只读输入。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Color Palette and Aesthetic Context, NFR18/NFR20]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Color Extraction Architecture]
- [Source: `_bmad-output/project-context.md` - Critical Don't-Miss Rules]
- [Source: `src/main.ts` - current runtime `extractPalette` implementation]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run generate:data`
- `npm run validate:data`
- `npm run build`

### Completion Notes List

- 新增 build-time `sharp` 图片取色 helper，过滤透明像素和近白背景噪声。
- 生成 `generated/data/pokemon-index.json`，覆盖 311 个 Pokemon，包含主色、色板、colorSource、fallbackReason、overrideSource 和 pattern。
- 生成 `generated/data/item-colors.json`，覆盖 1,219 个 compact items，包含 `itemPrimaryColor`、`colorSource`、`fallbackReason`。
- 新增 `data/overrides/pokemon-metadata.json` 和 schema validator，支持 primaryColor、palette、pattern，并在生成时优先于自动取色。
- `validate:data` 增加透明像素、近白背景、解码失败 fallback、override schema fixture 校验，并校验生成数据不包含本机绝对路径。
- review 后补强：override schema 失败会中断生成；summary 计数、产物数量、gzip 预算、Pokemon sequence 和 slug 来源均有校验。

### File List

- `package.json`
- `package-lock.json`
- `tsconfig.scripts.json`
- `src/data/schemas.ts`
- `scripts/generate-data.ts`
- `scripts/lib/image-colors.ts`
- `scripts/validate-color-fixtures.ts`
- `data/overrides/pokemon-metadata.json`
- `generated/data/compact-items.json`
- `generated/data/item-colors.json`
- `generated/data/pokemon-index.json`
