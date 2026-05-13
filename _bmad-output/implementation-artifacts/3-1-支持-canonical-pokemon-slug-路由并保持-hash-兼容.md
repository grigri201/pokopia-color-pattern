# Story 3.1: 支持 canonical `/pokemon/{slug}/` 路由并保持 hash 兼容

Status: ready-for-dev

## Story

As a 用户,
I want 通过 `/pokemon/{slug}/` 或旧的 `#slug` 访问同一只 Pokemon,
so that 直接访问、分享链接和现有 SPA 导航都能工作。

## Acceptance Criteria

1. Given URL pathname 符合 `/pokemon/{slug}/`, when 应用启动并 hydrate, then 应用优先使用 pathname slug 选择 Pokemon, and 不先渲染默认 Ditto 后再跳转。
2. Given URL 没有 pathname slug 但包含 `#slug`, when 应用启动, then 应用使用 hash slug 选择 Pokemon, and 保留现有 hash 导航兼容。
3. Given URL 没有有效 pathname slug 或 hash slug, when 应用启动, then 应用使用默认 `ditto`, and unknown slug 显示可恢复 not-found 状态而不是崩溃。

## Tasks / Subtasks

- [ ] 实现共享 slug/route parser (AC: 1, 2, 3)
  - [ ] 新增 `parsePokemonSlugFromLocation` 或等价函数，优先级为 pathname `/pokemon/{slug}/`，其次 hash，最后 `ditto`。
  - [ ] 共享 slug normalize 逻辑，避免 pathname 和 hash 使用两套规则。
- [ ] 调整 boot 初始选择逻辑 (AC: 1, 2)
  - [ ] 应用启动时先解析 route slug，再选择 Pokemon 数据。
  - [ ] 避免先渲染默认 Ditto 再替换为路径 Pokemon。
- [ ] 保持 hash 导航兼容 (AC: 2)
  - [ ] 现有 `hashchange` 行为继续可用。
  - [ ] in-app 切换可以继续更新 hash，但不得覆盖 pathname slug 的初始优先级。
- [ ] unknown slug 可恢复状态 (AC: 3)
  - [ ] unknown path/hash slug 展示 not-found 或可恢复状态，提供返回 index/search 的路径。
  - [ ] 不 fallback 到错误 Pokemon 且不崩溃 hydration。

## Dev Notes

- 当前 `src/main.ts` 启动只解析 `location.hash`，无 hash 时默认 Ditto；`selectPokemon()` 找不到 slug 时 fallback 到第一个 Pokemon。这会破坏 `/pokemon/{slug}/` hydrate parity，需要修正。
- Canonical route 是 `/pokemon/{slug}/`，legacy/current route 是 `/#slug`。Hydration 优先 pathname slug，其次 hash，最后默认 `ditto`。
- 资源路径和 SSG 输出由 Story 3.2 处理；本故事先完成 app route 语义。
- Unknown slug 不应静默显示第一个 Pokemon，否则分享链接错误无法被用户或维护者发现。

### Project Structure Notes

- 预期路径：`src/domain/slug.ts`、`src/app/router.ts`、`src/app/boot.ts` 或渐进式 `src/main.ts`。
- Route parser 应是 browser-safe pure function，便于 unit test 和 SSG/smoke 复用。
- 不要引入前端 routing framework。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` - Sharing and Fast Access, NFR13]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Static Rendering & Hydration Architecture]
- [Source: `_bmad-output/project-context.md` - pathname/hash compatibility rules]
- [Source: `src/main.ts` - current hash-only route logic]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List
