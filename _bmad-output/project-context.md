---
project_name: 'pokopia-color-pattern'
user_name: 'Grigri'
date: '2026-05-13'
sections_completed:
  - discovery
  - technology_stack
  - language_specific_rules
  - framework_specific_rules
  - testing_rules
  - code_quality_style_rules
  - development_workflow_rules
  - critical_dont_miss_rules
status: 'complete'
rule_count: 57
optimized_for_llm: true
existing_patterns_found: 8
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- 项目是 Vite + TypeScript 的 brownfield Web SPA，`package.json` 使用 `"type": "module"`。
- 当前构建入口是 `index.html` + `src/main.ts` + `src/styles.css`，不是 React/Vue/Next 项目。
- TypeScript 使用 strict 模式：`strict: true`、`isolatedModules: true`、`moduleResolution: "Bundler"`、`noEmit: true`。
- TypeScript 版本以 lockfile 为准：`typescript` 5.9.3。
- Vite 版本以 lockfile 为准：`vite` 7.3.3；`package.json` 中是 `^7.1.12` 范围。
- Node 类型版本以 lockfile 为准：`@types/node` 24.12.4。
- 构建命令是 `npm run build`，实际执行 `tsc --noEmit && vite build`。
- 开发服务器命令是 `npm run dev`，固定 `vite --host 127.0.0.1`。
- `vite.config.ts` 中已有构建后复制规则：把 `docs/pokopia_image_sources` 复制到 `dist/docs/pokopia_image_sources`，并过滤 `.DS_Store`。

## Critical Implementation Rules

### Language-Specific Rules

- 保持 ESM 风格；新增源码使用 `import` / `export`，不要引入 CommonJS。
- TypeScript 必须通过 `strict` 和 `isolatedModules`；新增数据结构优先显式建模为 `type` / `interface`，不要用宽泛 `any` 绕过数据契约。
- 浏览器端代码不能依赖 Node-only API；Node 构建脚本可以使用 `node:fs`、`node:path` 等内置模块。
- CSV/JSON manifest 解析要保留确定性：同一输入必须生成相同排序和输出，排序 tie-breaker 要显式。
- 用户可见 HTML 字符串必须经过 `escapeHtml` 或等价转义；不要把 manifest 字段直接插入 `innerHTML`。
- URL slug 继续使用小写 kebab-case 规则；路径型 `/pokemon/{slug}/` 与现有 hash slug 必须共享同一规范化逻辑。
- 图片取色失败、manifest 字段缺失、JSON 字段解析失败时要返回可追踪 fallback，不要让页面空白或构建静默产生坏数据。
- `docs/oklch_color.ts` 是 OKLCH 方法论的源头；推荐引擎不得另写一套不一致的色彩和谐规则。

### Framework-Specific Rules

- 不要把项目改造成 React/Vue/Next；除非后续架构明确批准，继续使用 Vite + 原生 DOM + TypeScript。
- Vite 入口仍以 `index.html` 和 `src/main.ts` 为中心；新增构建期生成逻辑优先放在独立 Node/TS 脚本，不要塞进浏览器运行时。
- `vite.config.ts` 已承担构建后复制 `docs/pokopia_image_sources` 的职责；新增产物复制或校验要兼容这个插件。
- 现有 SPA 依赖 `#slug` 选择 Pokemon；实现 `/pokemon/{slug}/` 时，hydrate 必须优先从 pathname 解析 slug，并保持 hash 导航兼容。
- 静态详情页不是空 shell：无 JS 时必须有 Pokemon 名称、图片、主色、色板和推荐摘要。
- Hydrate 后的 Pokemon、推荐列表、分页状态必须与静态 HTML 对应同一个 slug，不能出现先渲染默认 Pokemon 再跳转的状态闪烁。
- 前端资源路径要能同时服务根路径 SPA 和 `/pokemon/{slug}/` 子路径静态页；引用生成数据和图片时避免写死只在根路径成立的相对路径。

### Testing Rules

- 当前仓库没有 Vitest/Jest/Playwright 配置；现有最低 gate 是 `npm run build`。
- 引入测试工具时保持轻量，并把命令接入 `package.json`；不要留下只能手动运行的隐式 gate。
- 推荐引擎必须用 fixture 覆盖偏好词命中、可染色 item、不可染色 item 和 OKLCH 和谐分支。
- Pokemon metadata override 必须测试主色、色板、pattern、搭配道具追加和搭配道具替换模式。
- compact item manifest、Pokemon metadata、推荐数据和 SSG 输出必须有 schema 或等价结构校验。
- 构建断言必须验证全部 311 个 Pokemon 都有 `/pokemon/{slug}/` 静态页，且固定样本页包含标题、图片、主色、色板和推荐摘要。
- 体积校验必须覆盖 compact item data gzip 小于 50KB、单个 Pokemon 推荐数据 gzip 小于 5KB。
- 浏览器 smoke test 至少覆盖直接访问一个静态 Pokemon 页并完成 hydrate 的路径。

### Code Quality & Style Rules

- 原始 Pokopia 数据源只读保留；compact data、推荐数据和 SSG 页面必须由构建脚本从原始数据与 override 数据生成。
- 生成文件要有稳定排序和稳定字段顺序；不要把当前时间、随机数或本机路径写入可复现产物。
- CSV manifest 字段中包含 JSON 字符串数组，例如 `tags`、`sources`、`favorite_category_ids`；读取时使用 JSON 解析并处理失败分支。
- item 图片扩展名不能只信 URL 后缀；此前存在 `.png` URL 返回 WebP 的情况，下载/复制逻辑应以 content-type 或实际文件为准。
- `.DS_Store`、`node_modules/`、`dist/` 已在 `.gitignore`；生成或提交前保持这些文件不进入版本库。
- CSS 继续使用现有全局样式与自定义属性；新增 UI 要检查移动端窄屏文本溢出、图片比例和可点击区域。
- Pokemon 图片 alt 包含 Pokemon 名称；推荐 item 图片 alt 包含 item 名称；纯装饰或占位图用空 alt。
- 不要编辑 installer-managed 的 `_bmad/config.toml` 或 `_bmad/config.user.toml` 来表达项目规则；团队覆盖应放在 `_bmad/custom/`。

### Development Workflow Rules

- 开始实现前先看 `_bmad-output/planning-artifacts/prd.md`；它是当前 brownfield 改造范围和验收约束的源头。
- 对 BMAD 工作流优先使用仓库本地 `.agents/skills/*`，不要假设全局 cached skill 路径一定适用。
- 若需要隔离较大改动，可按 `AGENTS.md` 指示新建 git worktree；普通文档或单点修改可在当前工作区处理。
- 提交前至少运行 `npm run build`；涉及生成数据时还要运行对应生成和校验命令。
- 数据/静态产物改动后运行 `git diff --check`，避免 generated CSV/Markdown 中的尾随空白。
- 提交范围要明确区分源码、生成数据、BMAD 输出和个人配置；不要把 `_bmad/config.user.toml` 当作项目变更提交。
- commit message 目前使用简短 imperative `feat: ...` 风格；继续保持清晰动词和范围。

### Critical Don't-Miss Rules

- 推荐规则不是“颜色越接近越好”：所有推荐先要求 Pokemon 偏好词命中。
- 可染色 item 命中偏好词后不要求主色和谐；不可染色 item 必须同时满足偏好词命中和 OKLCH 和谐。
- 推荐结果必须保留解释字段：`matchedPreferenceTerms`、`isDyeable`、`pokemonPrimaryColor`、`itemPrimaryColor`、`harmonyStatus`、`harmonyType`、`overrideSource`、`rank`、`pageIndex`。
- 图片取色失败时优先使用 Pokemon metadata override；没有 override 时使用默认中性色/空色板，并记录 `colorSource: fallback`。
- `docs/pokopia_image_sources/item_portraits/manifest.csv` 是完整 1,219 个 in-collection item 的重数据源，不得继续作为首屏必需资源。
- `docs/pokopia_image_sources/decorative_item_images.csv` 是较窄装饰集；不要把它误认为完整 placeable item 数据。
- `favorite_category_ids` 曾用于判断 Food/Materials 是否可放置为偏好物；变更该规则前必须重新验证数据选择口径。
- `Farm soil (Skyland)` 曾需要共享 InfiPoke fallback 图片；重新下载或重建图片管线时要保留这种 404/fallback 处理能力。
- SSG 页面必须支持无 JS 核心阅读；不要只生成依赖客户端 fetch 后才出现内容的空 HTML。
- 静态页和 hydrated SPA 必须共享数据契约；不要维护两套会漂移的推荐排序或分页逻辑。

---

## Usage Guidelines

**For AI Agents:**

- 实现代码前先读本文件和 `_bmad-output/planning-artifacts/prd.md`。
- 优先遵守更具体、更限制性的规则。
- 若发现新的非显而易见项目规则，更新本文件或在 BMAD 流程中提出更新。

**For Humans:**

- 保持本文件短小，只记录 AI agent 容易漏掉的项目规则。
- 技术栈、数据契约、构建流程或推荐规则变化时更新本文件。
- 定期删除已经过时或变成常识的规则。

Last Updated: 2026-05-13
