---
title: '支持 Chrome presentation 快捷键同步图鉴全屏'
type: 'feature'
created: '2026-05-17'
status: 'done'
route: 'one-shot'
---

# 支持 Chrome presentation 快捷键同步图鉴全屏

## Intent

**Problem:** macOS Chrome 的 `Control + Command + F` 只是应用窗口全屏，不等价于 Windows 上 `F11` 隐藏地址栏和书签栏的沉浸模式；用户实际要覆盖的是 Chrome presentation/隐藏工具栏路径。

**Approach:** 保留既有 `F11` 与 `fullscreenchange` 监听，同时新增 `Command + Shift + F` 作为 Chrome/macOS presentation 快捷键入口。该入口不拦截浏览器默认行为，只在短延迟后打开现有图鉴 fullscreen overlay，并保持当前 Pokemon、URL 和 history 不变。

## Suggested Review Order

**Fullscreen Entrypoints**

- 入口顺序保留 F11，再追加 Chrome presentation 快捷键。
  [`main.ts:570`](../../src/main.ts#L570)

- 快捷键只匹配 `Command + Shift + F`，避免吞掉系统全屏。
  [`main.ts:891`](../../src/main.ts#L891)

- presentation 路径直接打开 overlay，不依赖不可见的 Chrome UI 状态。
  [`main.ts:915`](../../src/main.ts#L915)

- 原生 Fullscreen API 事件仍作为独立同步信号保留。
  [`main.ts:616`](../../src/main.ts#L616)

**Regression Coverage**

- F11 路径继续验证 URL/history 不变。
  [`pokemon-page.spec.ts:142`](../../tests/smoke/pokemon-page.spec.ts#L142)

- `Meta+Shift+F` 覆盖 macOS Chrome presentation intent。
  [`pokemon-page.spec.ts:164`](../../tests/smoke/pokemon-page.spec.ts#L164)
