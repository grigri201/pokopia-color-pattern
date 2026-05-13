# Story 1.2: 生成 Pokemon 和 item 色彩元数据

Status: ready-for-dev

## Story

As a 用户,
I want Pokemon 详情页展示稳定的主色、色板和 item 主色基础数据,
so that 我可以理解搭配体验的色彩依据。

## Acceptance Criteria

1. Given Pokemon 和 item 本地图片资源存在, when 维护者运行数据生成命令, then 系统为全部 Pokemon 生成主色和多色色板数据, and 系统为参与推荐的 item 生成主色数据。
2. Given 图片存在透明背景、WebP 或取色失败场景, when 颜色提取运行, then 提取逻辑忽略透明像素和近白背景噪声, and 失败时记录 `colorSource: "fallback"` 与可追踪 fallback 原因，不让页面空白或构建静默生成坏数据。
3. Given Pokemon 主色或色板需要人工修正, when override 数据提供对应字段, then Pokemon metadata 生成优先使用 override, and override 数据本身通过 schema 或等价结构校验。

## Tasks / Subtasks

- [ ] 生成 Pokemon 色彩 metadata (AC: 1, 2, 3)
  - [ ] 从 `docs/pokopia_image_sources/pokemon_portraits/manifest.csv` 读取全部 311 个 Pokemon。
  - [ ] 生成 `generated/data/pokemon-index.json`，包含 slug、sequence、name、zhName、image、primaryColor、palette、colorSource 和 fallback reason。
  - [ ] 对透明背景和近白背景噪声做过滤，失败时写入 fallback 而不是抛出空白结果。
- [ ] 为参与推荐的 item 生成主色基础字段 (AC: 1, 2)
  - [ ] 在 compact item 或配套 metadata 中补充 `itemPrimaryColor`、`colorSource`、`fallbackReason`。
  - [ ] 处理 PNG/WebP 输入，不依赖 URL 后缀判断图片真实格式。
- [ ] 建立 Pokemon metadata override schema (AC: 3)
  - [ ] 新增 `data/overrides/pokemon-metadata.json` 和 schema/校验逻辑，支持 primary color、palette、pattern 字段。
  - [ ] override 优先级高于自动取色，并在生成结果记录 override 来源。
- [ ] 增加 fixture 或单元校验 (AC: 2, 3)
  - [ ] 覆盖透明像素、近白背景、取色失败 fallback、override 覆盖主色和色板。
  - [ ] 校验生成数据不包含本机绝对路径或开发机私有信息。

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

TBD

### Debug Log References

### Completion Notes List

### File List
