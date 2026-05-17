# Open Design: Pokemon 全屏布局规格

created: 2026-05-17
status: first-pass implementation reference
source: current `Pokopia Decor Dex` layout

## 目标

在不替换现有三栏/抽屉布局的前提下，新增一个应用内全屏展示模式。现有页面继续负责浏览、搜索、筛选和完整推荐分页；全屏模式只负责当前 Pokemon 的沉浸式展示、偏好词强化和色板阅读。

## 布局决策

- 全屏入口放在现有主舞台顶部操作区，和语言切换、GitHub 链接同一层级。
- 全屏模式是应用内 overlay，核心体验不依赖浏览器 Fullscreen API。
- 全屏展示内容包括 Pokemon 图像、名称、编号、slug、HEX/RGB/CMYK、完整色板和偏好词。
- 偏好词作为独立 `偏好档案` 模块展示；为空时显示可读空状态，不隐藏模块。
- 桌面整体布局为左右结构：左侧是信息，右侧是 Pokemon 画像卡片。
- 左侧信息区再分为上方名称/编号，下方左侧主色数值、色板与图案，下方右侧纵向偏好；下方左右两区保持等高。
- 中窄屏与移动端改为纵向滚动：信息区在上，Pokemon 画像卡片在下；信息区内部依次显示名称、主色/色板、偏好。
- 右上角操作区包含语言切换按钮和 icon-only 关闭按钮；语言按钮位于关闭按钮左侧。
- 退出路径包括右上角关闭图标按钮和 Escape。
- 焦点进入全屏后移动到关闭图标按钮，退出后回到全屏入口。
- URL 与当前 Pokemon 选择保持不变；全屏状态不写入分享链接。

## 壁纸后续约束

本轮先完成全屏布局承载结构，不实现导出。后续壁纸模板应复用全屏视觉语言，但导出比例、尺寸、文件名、预览/下载交互仍需单独确认。

## Open Design 标记

- `fullscreen-layout`: 全屏 overlay 总体布局。
- `fullscreen-toolbar`: 全屏顶部关闭与品牌区域。
- `fullscreen-content`: 左信息、右 Pokemon 卡片主体。
- `fullscreen-info`: 左侧信息区。
- `fullscreen-identity`: 名称和编号身份区。
- `fullscreen-color-stack`: 主色数值、色板与图案堆叠区。
- `fullscreen-preferences`: 信息区下方右侧纵向偏好词模块。
- `fullscreen-palette`: 中文标题色板模块。
- `fullscreen-pattern`: 色板下方中文标题图案模块。
- `fullscreen-pokemon-card`: 右侧 Pokemon 画像卡片。

## 验收样本

- `No.180 利欧路`: 当前审查样本，用于验证中文界面、色板、标签换行与画像卡牌布局。
- `Ditto`: 偏好词为空，用于验证空状态。
- `Pikachu`: 高识别度样本，用于验证移动端图像与标题尺度。
