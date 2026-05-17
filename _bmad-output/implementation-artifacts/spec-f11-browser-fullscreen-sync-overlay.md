---
title: '同步 F11 浏览器全屏与图鉴全屏'
type: 'feature'
created: '2026-05-17'
status: 'done'
route: 'one-shot'
---

# 同步 F11 浏览器全屏与图鉴全屏

## Intent

**Problem:** 用户按 F11 让浏览器进入原生全屏时，Pokopia Decor Dex 仍停留在普通三栏页面，和用户对“全屏查看图鉴”的预期不一致。

**Approach:** 保留现有应用内 fullscreen overlay，不拦截浏览器 F11 行为；在 F11 后通过 resize/Fullscreen API 信号确认浏览器进入全屏态，再同步打开当前 Pokemon 的 overlay，并保持 URL/history 不变。

## Suggested Review Order

**Fullscreen Sync**

- F11 入口不阻止浏览器默认行为，只安排同步检测。
  [`main.ts:569`](../../src/main.ts#L569)

- 延迟与 resize 信号共同覆盖浏览器全屏切换时序。
  [`main.ts:886`](../../src/main.ts#L886)

- 只在当前 Pokemon 存在且未打开 overlay 时同步进入。
  [`main.ts:905`](../../src/main.ts#L905)

- 同时接受 screen 和 avail screen，降低系统 chrome 差异风险。
  [`main.ts:922`](../../src/main.ts#L922)

**Regression Coverage**

- Smoke 用例验证 F11 打开 overlay 且不改 URL/history。
  [`pokemon-page.spec.ts:142`](../../tests/smoke/pokemon-page.spec.ts#L142)
