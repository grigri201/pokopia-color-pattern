# Story 1.5: 验证 compact 数据体积与生成稳定性

Status: done

## Story

As a 维护者,
I want 用自动化校验确认 compact 数据小、稳定且可重复生成,
so that 后续推荐和静态页工作建立在可信数据基础上。

## Acceptance Criteria

1. Given compact item data 已生成, when 维护者运行验证命令, then 校验确认 compact item data gzip 小于 50KB, and 完整 `item_portraits/manifest.csv` 不在首屏运行时必需加载路径中。
2. Given 同一 raw manifest、图片和 override 输入, when 数据生成命令连续运行两次, then 输出排序和字段顺序保持稳定, and runtime 数据不包含当前时间、随机数、本机绝对路径或开发机私有信息, and runtime/build 输出不引入账号、支付、敏感个人数据收集或外部服务密钥。
3. Given 维护者运行项目 build gate, when compact data schema、override schema 或体积校验失败, then 命令以非零状态失败, and 输出包含可操作的文件路径和失败原因。

## Tasks / Subtasks

- [x] 实现 compact data 体积校验 (AC: 1, 3)
  - [x] 计算 `generated/data/compact-items.json` gzip size，阈值为 50KB。
  - [x] 校验失败时打印实际大小、阈值和文件路径。
- [x] 验证首屏运行时不读取完整 item manifest (AC: 1)
  - [x] 在 build 或测试中检查 browser entry 不再 fetch `docs/pokopia_image_sources/item_portraits/manifest.csv` 作为关键路径。
  - [x] 保留 raw docs copy 仅作为静态资源/source traceability，不作为 runtime data API。
- [x] 实现 deterministic 输出检查 (AC: 2)
  - [x] 连续运行数据生成，比较 compact item data、Pokemon metadata 和 schema 输出内容稳定。
  - [x] 生成数据不得包含当前时间、随机数、本机绝对路径、开发机用户名、密钥或私有环境值。
- [x] 接入 build gate (AC: 3)
  - [x] 将 generation、schema validation、size validation 接入 `package.json` 命令。
  - [x] 确保 `npm run build` 或明确 production gate 在失败时非零退出。

### Review Findings

- [x] [Review][Patch] deterministic 校验记录需要覆盖 schema contract source，避免 story 声明和 gate 不一致 [`scripts/validate-build.ts`]
- [x] [Review][Patch] runtime manifest guard 过窄，需要扫描更宽浏览器源码扩展和 dist runtime bundle [`scripts/validate-build.ts`]
- [x] [Review][Patch] secret/private-path 扫描缺少 GitHub/AWS token 和 Linux/Windows 用户路径模式 [`scripts/validate-build.ts`]
- [x] [Review][Patch] 生成器失败后应停止后续 snapshot/schema 读取，避免旧数据掩盖失败 [`scripts/validate-build.ts`]
- [x] [Review][Patch] 生成 JSON 损坏时需要输出可操作的文件路径和 JSON parse 原因 [`scripts/validate-build.ts`]
- [x] [Review][Dismiss] `dist/docs/**` 是 raw source traceability copy，不作为 runtime data API；dist runtime 扫描限定为 `index.html`、`assets/**`、`data/**`

## Dev Notes

- 当前 `npm run build` 仅为 `tsc --noEmit && vite build`；架构要求 production gate 最终包括 generate data、typecheck、tests、Vite build、SSG generation、build assertions 和 smoke tests。本故事先把 Epic 1 compact data gate 接入。
- NFR2 是 compact item data gzip 小于 50KB；NFR1 是完整 item manifest 不再作为首屏必需资源。
- 生成 runtime 数据不要写时间戳；build reports 可以包含 timestamp，但不能作为 deterministic runtime data。
- 原始数据、账号、支付、敏感个人数据、外部服务密钥都不属于本 PRD 范围，不应出现在 generated runtime/build output。
- 运行校验后使用 `git diff --check` 检查生成 Markdown/CSV/JSON 变更中的空白问题。

### Project Structure Notes

- 预期路径：`scripts/validate-build.ts`、`generated/reports/generation-summary.json`、`generated/reports/build-validation.json`。
- 若新增 Vitest 或其他测试工具，保持轻量，并把命令接入 `package.json`。
- 不要提交 `dist/`、`node_modules/` 或 `.DS_Store`。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.5]
- [Source: `_bmad-output/planning-artifacts/prd.md` - NFR2/NFR5/NFR14/NFR19/NFR20/NFR27/NFR28/NFR29]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Build gate, Format Patterns]
- [Source: `_bmad-output/project-context.md` - Development Workflow Rules]
- [Source: `package.json` - current build script]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run validate:build`
- `npm run validate:dist`
- `npm run build`
- `npm run validate:data`
- `git diff --check`

### Completion Notes List

- 新增 `scripts/validate-build.ts`，连续运行生成器两次并比较 `generated/data/compact-items.json`、`item-colors.json`、`pokemon-index.json` 的 sha256，验证 deterministic 输出。
- build gate 现在校验 compact gzip 小于 50KB；当前结果为 `47851/51200` bytes。
- build gate 扫描浏览器源码，阻止首屏 runtime 重新引用完整 `docs/pokopia_image_sources/item_portraits/manifest.csv`。
- runtime generated data 和 dist runtime 输出会扫描本机绝对路径、timestamp-like 值和 secret-like 值；raw docs copy 继续作为 source traceability，不作为 runtime data API。
- `npm run build` 已接入 `validate:build -> tsc -> vite build -> validate:dist`。
- Review 后加宽 manifest/runtime secret 扫描，并补齐生成器失败、JSON parse 失败的明确文件级错误。

### File List

- `package.json`
- `scripts/validate-build.ts`
- `_bmad-output/implementation-artifacts/1-5-验证-compact-数据体积与生成稳定性.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-13: 接入 compact data deterministic/size/runtime-boundary build validation gate。
