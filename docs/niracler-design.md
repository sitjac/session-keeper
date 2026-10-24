# Bokushi 设计系统

> 面向 Agent 的可消费设计规范，适用于 Bokushi（博物志）个人博客。
> 事实来源：`src/styles/tokens.css` + `src/styles/global.css`

## 1. 视觉主题与氛围

**风格**：受日式文具启发的温暖、纸张般的阅读体验
**框架**：Apple 人机界面指南（清晰、一致、尊重内容）
**个性**：内容优先、克制的交互、充裕的留白
**字体**：jf-openhuninn-2.0（中文优化的开源字体），搭配系统回退字体
**基础字号**：17px（1.0625rem）—— 符合 Apple HIG 对可读性的要求

博客采用温暖的大地色系，配以陶土色点缀。深色模式是「加深暖意」而非转向冷色/蓝色。正文中的 `<strong>` 标签以强调色渲染，而非加粗的黑色。

## 2. 色彩调色板与角色

### 浅色主题（默认）

| Token | 值 | 角色 |
|-------|-------|------|
| `--color-bg-page` | `#fffaf4` | 页面背景 —— 暖米白 |
| `--color-bg-surface` | `#ffffff` | 卡片 / 面板背景 |
| `--color-bg-muted` | `#f8efe4` | 次级背景、脚注、胶囊标签 |
| `--color-text-primary` | `#2a1c17` | 标题、正文文本 |
| `--color-text-secondary` | `#46342a` | 段落、列表项 |
| `--color-text-muted` | `#5f4d42` | 说明文字、元数据、标记 |
| `--color-text-inverse` | `#fef9f0` | 深色背景上的文本 |
| `--color-accent` | `#fb8f68` | 主强调色 —— 陶土橙 |
| `--color-accent-dark` | `#d67046` | 警示标题、更深一档的强调色 |
| `--color-accent-soft` | `#ffe7dc` | 强调色背景淡色 |
| `--color-link` | `#c05c3e` | 行内链接色 |
| `--color-link-hover` | `#9a472f` | 链接悬停态 |
| `--color-border` | `#dcc9ba` | 默认边框 |
| `--color-border-soft` | `rgba(42 28 23 / 0.08)` | 卡片细边框 |
| `--color-border-subtle` | `rgba(42 28 23 / 0.12)` | 代码块、表格边框 |
| `--color-border-strong` | `#cbb69d` | 强调边框 |
| `--color-success` | `#4f8b63` | 成功态 |
| `--color-warning` | `#d8871d` | 警告态 |
| `--color-danger` | `#c84c3a` | 危险 / 注意态 |
| `--color-note` | `#8d7bd6` | 提示 / 信息态 |
| `--color-code-bg` | `#f6f8fa` | 代码块背景 |

### 深色主题（`[data-theme="dark"]`）

| Token | 值 | 角色 |
|-------|-------|------|
| `--color-bg-page` | `#140e0b` | 深暖黑 |
| `--color-bg-surface` | `#1b140f` | 卡片背景 |
| `--color-bg-muted` | `#241914` | 次级表面 |
| `--color-text-primary` | `#f8ede1` | 主文本 |
| `--color-text-secondary` | `#d7c6b8` | 正文文本 |
| `--color-text-muted` | `#b8a090` | 说明文字、元数据 |
| `--color-text-inverse` | `#1b120c` | 浅色表面上的文本 |
| `--color-accent` | `#fb8f68` | 两种主题下相同的强调色 |
| `--color-accent-dark` | `#d67046` | 深强调色 / 链接 |
| `--color-accent-soft` | rgba(251, 143, 104, 0.16) | 透明淡色 |
| `--color-link` | `#ffb088` | 深色背景下更暖的链接色 |
| `--color-link-hover` | `#ffcfb3` | 链接悬停态 |
| `--color-border` | `#3b2b22` | 边框 |
| `--color-border-strong` | `#4b372d` | 强边框 |
| `--color-success` | `#8bcaa0` | 成功态 |
| `--color-warning` | `#f3b05b` | 警告态 |
| `--color-danger` | `#f18879` | 危险态 |
| `--color-note` | `#a79fe6` | 提示态 |
| `--color-code-bg` | `#1e1e2e` | Catppuccin Mocha 基础色 |

### 强调色淡色刻度

用于悬停态、背景和细微填充：

| Token | 定义 |
|-------|-----------|
| `--color-accent-tint` | `rgba(accent-rgb / 0.16)`（浅色）或 `0.22`（深色） |
| `--color-accent-tint-6` | `color-mix(in srgb, accent 6%, transparent)` |
| `--color-accent-tint-8` | `color-mix(in srgb, accent 8%, transparent)` |
| `--color-accent-tint-12` | `color-mix(in srgb, accent 12%, transparent)` |
| `--color-accent-tint-18` | `color-mix(in srgb, accent 18%, transparent)` |

### 遮罩 Token（不随主题变化）

| Token | 值 |
|-------|-------|
| `--color-overlay-dark-35` | `rgba(0, 0, 0, 0.35)` |
| `--color-overlay-dark-40` | `rgba(0, 0, 0, 0.4)` |
| `--color-overlay-dark-60` | `rgba(0, 0, 0, 0.6)` |
| `--color-overlay-light-25` | `rgba(255, 255, 255, 0.25)` |
| `--color-overlay-light-35` | `rgba(255, 255, 255, 0.35)` |
| `--color-overlay-light-50` | `rgba(255, 255, 255, 0.5)` |
| `--color-overlay-light-80` | `rgba(255, 255, 255, 0.8)` |
| `--color-overlay-light-90` | `rgba(255, 255, 255, 0.9)` |

## 3. 排版规则

**主字体**：`jf-openhuninn-2.0`，然后是系统字体栈（`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`）
**代码字体**：`Fira Code, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace`
**字间距**：正文 `0.01em`（有助于中文可读性）

### 字号刻度

| Token | 尺寸 | 典型用途 |
|-------|------|-------------|
| `--font-size-2xs` | 0.6875rem (11px) | 目录编号、极小字号 |
| `--font-size-xs` | 0.8125rem (13px) | 胶囊标签、代码块语言标识、说明文字 |
| `--font-size-sm` | 0.9375rem (15px) | 图注、脚注、移动端目录 |
| `--font-size-base` | 1.0625rem (17px) | 正文文本 |
| `--font-size-lg` | 1.25rem (20px) | H4 |
| `--font-size-xl` | 1.5rem (24px) | H3 |
| `--font-size-2xl` | 1.875rem (30px) | H2 |
| `--font-size-3xl` | 2.25rem (36px) | H1 |

### 行高

| Token | 值 | 用途 |
|-------|-------|-----|
| `--line-height-base` | 1.75 | 正文文本、列表 |
| `--line-height-relaxed` | 1.65 | 图注 |
| `--line-height-tight` | 1.22 | 标题 |

### 标题样式

| 层级 | 尺寸 | 字重 | 字间距 | 额外 |
|-------|------|--------|---------------|-------|
| H1 | 3xl (2.25rem) | 700 | 0 | — |
| H2 | 2xl (1.875rem) | 800 | -0.02em | 通过 CSS 计数器自动编号 |
| H3 | xl (1.5rem) | 700 | -0.01em | 以 `h2.h3` 编号 |
| H4 | lg (1.25rem) | 700 | 0 | 以 `h2.h3.h4` 编号 |

### 加粗 / 强调约定

`.prose` 内的 `<strong>` 和 `<b>` 以 `--color-accent`（陶土色）渲染，`font-weight: 600`。这是刻意的设计选择——加粗文本是一种强调高亮，而不只是更重的字重。

## 4. 组件样式

### 表面卡片（`.surface-card`）

基础：白色背景、细边框、圆角（radius-lg = 16px）、柔和阴影、0.2s 过渡。

| 变体 | 类名 | 行为 |
|---------|-------|----------|
| 默认 | `.surface-card` | 白色背景、`border-soft`、`shadow-soft` |
| 柔和 | `--soft` | 无阴影、细边框、80/20 的 surface/muted 背景混合 |
| 扁平 | `--flat` | 无阴影、仅细边框 |
| 紧凑 | `--compact` | 更小的圆角（radius-md = 10px） |
| 悬停：边框 | `--hover-border` | 悬停时边框加深 + 阴影出现 |
| 悬停：无 | `--hover-none` | 禁用悬停过渡 |

### 胶囊标签 / 标签（`.pill`）

内联徽章，`radius-full`（胶囊形）、淡色背景、细边框、xs 字号、600 字重。

| 变体 | 选择器 | 行为 |
|---------|----------|----------|
| 默认 | `.pill` | 淡色背景、次级文本 |
| 可点击 | `.pill--clickable` | 光标指针，悬停 opacity:0.8 |
| 强调 | `[data-tone="accent"]` | accent-soft 背景、accent 文本、accent 淡色边框 |

### 图标按钮（`.icon-btn`）

透明背景、次级文本色，悬停时过渡到强调色。

| 尺寸 | 类名 | 尺寸 |
|-------|-------|-----------|
| XS | `--xs` | 2rem × 2rem |
| SM | `--sm` | 2.75rem × 2.75rem |
| MD | `--md` | 3rem × 3rem |

| 形状 | 类名 | 圆角 |
|-------|-------|--------------|
| 圆形 | `--round` | radius-full (9999px) |
| 方形 | `--square` | radius-md (10px) |
| 带边框 | `--bordered` | + 1px border-soft |

### 下划线链接（`.underline-link`）

链接色文本，带动画下划线：从 `scaleX(0.6)` 开始，悬停时扩展至 `scaleX(1)`。border-bottom 使用 70% 透明度的链接色。

### 眉题（`.eyebrow`）

XS 字号、0.12em 字间距、大写、淡色、700 字重。用于章节标签。

### 焦点样式（`.focus-accent`）

在 `:focus-visible` 上使用 2px 实线 `accent-soft` 轮廓，带 2px 偏移。

### Markdown 警示框

左边框 4px + 淡色背景。颜色按类型区分：

| 类型 | 边框色 | 背景 |
|------|-------------|-----------|
| 提示 Note | `--color-note` | note 18% 混合 |
| 技巧 Tip | `--color-success` | success 18% 混合 |
| 警告 Warning/Important | `--color-warning` | warning 18% 混合 |
| 注意 Caution | `--color-danger` | danger 15% 混合 |

### 代码块

- 行内代码：`0.1em 0.4em` 内边距、`radius-sm`、muted 15% 混合背景、0.95em 字号
- Pre 代码块：`space-4` 内边距、`radius-md`、`border-subtle`、`code-bg`
- 代码块头部：flex 行，包含语言标签（xs、大写、0.08em 字间距）+ 复制按钮
- Shiki 双主题：`--shiki-light` / `--shiki-dark` CSS 变量

### 主题切换

三态循环：系统 → 浅色 → 深色。图标动画使用 `scale + rotate` 过渡，带弹簧缓动（`cubic-bezier(0.34, 1.56, 0.64, 1)`）。两种变体：`header`（极简）和 `mobile`（全宽带标签）。

## 5. 布局原则

### 页面外壳

```css
.page-shell {
    max-width: var(--layout-max-width);  /* 72rem */
    margin-inline: auto;
    padding-block: var(--space-8);       /* 2rem */
    padding-inline: var(--space-4);      /* 1rem, → space-6 在 640px+ */
}
```

### 内容宽度

- `--layout-max-width`: 72rem (1152px) —— 外层页面容器
- `--measure`: 68ch —— 正文可读性上限
- `--measure-wide`: 72ch —— 更宽的内容区域

### 间距刻度

| Token | 值 | 像素 |
|-------|-------|--------|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.25rem | 20px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-12` | 3rem | 48px |

### 章节堆叠

`.section-stack` 使用 `display: grid`，`gap: clamp(space-6, 3vw, space-12)` —— 响应式间距在 24px 到 48px 之间伸缩。

## 6. 深度与层级

### 阴影预设

| Token | 浅色值 | 深色值 |
|-------|------------|------------|
| `--shadow-soft` | `0 6px 18px rgba(47,37,25, 0.08)` | `0 10px 28px rgba(0,0,0, 0.32)` |
| `--shadow-strong` | `0 16px 36px rgba(47,37,25, 0.14)` | `0 24px 42px rgba(0,0,0, 0.44)` |
| `--shadow-lightbox` | `0 20px 60px rgba(0,0,0, 0.4)` | `0 20px 60px rgba(0,0,0, 0.6)` |
| `--shadow-button-hover` | `0 6px 20px rgba(251,143,104, 0.3)` | `0 6px 20px rgba(251,159,116, 0.35)` |

### 圆角刻度

| Token | 值 | 用途 |
|-------|-------|-----|
| `--radius-xs` | 2px | 复选框 |
| `--radius-sm` | 6px | 行内代码、焦点轮廓 |
| `--radius-md` | 10px | 代码块、紧凑卡片、警示框 |
| `--radius-lg` | 16px | 卡片、图片、弹窗 |
| `--radius-full` | 9999px | 胶囊标签、圆形按钮 |

### 过渡时长

| Token | 值 | 用途 |
|-------|-------|-----|
| `--transition-fast` | 0.15s ease | 微交互 |
| `--transition-base` | 0.2s ease | 大多数 UI 过渡 |
| `--transition-slow` | 0.3s ease | 面板、抽屉 |
| `--transition-slower` | 0.5s ease | 主题图标旋转 |

## 7. 应该做与不应该做

### 应该做

- 所有颜色使用 CSS 变量（`var(--color-*)`）—— 绝不在组件中硬编码十六进制值
- 使用语义化 Tailwind token（`text-secondary`、`bg-surface`）而非原始值
- 悬停效果仅限颜色/边框变化
- 标准交互使用 `--transition-base`（0.2s）
- 在 prose 内容中以强调色渲染 `<strong>`
- 使用 `.surface-card` 变体，而非自定义卡片样式
- 尊重 `prefers-reduced-motion` —— 所有动画都有 `0.01ms` 回退

### 不应该做

- 不要使用 `translateY` 上浮动画（设计原则：微妙，而非弹跳）
- 不要新增阴影层级 —— 使用 `shadow-soft` 或 `shadow-strong`
- 不要在 Astro 组件中使用原始十六进制值 —— 始终引用 token
- 不要引入新字体或更改基础 17px 字号
- 不要绕过三态主题切换（系统/浅色/深色）
- 除非在 Mermaid 图表覆盖中（由于库的内联样式而不可避免），不要使用 `!important`

## 8. 响应式行为

### 断点

| 断点 | 宽度 | 关键变化 |
|-----------|-------|-------------|
| 移动端（默认） | < 640px | `padding-inline: space-4`（16px），单列 |
| SM | ≥ 640px | `padding-inline: space-6`（24px） |
| MD | ≥ 768px (48rem) | 表格从卡片模式切换为表格布局 |

### 表格转卡片模式

带 `data-card-mode="cards"` 的表格在 48rem 以下折叠为堆叠卡片：

- `thead` 被隐藏
- 每个 `<tr>` 变成带 `radius-md`、`shadow-soft` 的卡片
- 每个 `<td>` 使用 `data-label` 属性渲染为标签-值对
- 标签为大写、xs 字号、淡色；值占据剩余宽度

### 移动端特定适配

- 目录：浮动按钮 → 抽屉（全宽、更大字号）
- 主题切换：`[data-variant="mobile"]` —— 带可见标签的全宽按钮
- 导航：响应式头部，带移动端菜单抽屉

## 9. Agent 提示指南

### 快速配色参考

为本博客生成 UI 时，使用以下语义映射：

```text
页面背景     → var(--color-bg-page)
卡片背景     → var(--color-bg-surface)
淡色/次级背景 → var(--color-bg-muted)
主文本        → var(--color-text-primary)
正文/段落文本 → var(--color-text-secondary)
说明/元数据文本 → var(--color-text-muted)
主强调色      → var(--color-accent)
链接          → var(--color-link)
卡片边框      → var(--color-border-soft)
```

### 组件选择指南

| 需求 | 使用 |
|------|-----|
| 卡片 / 面板 | `.surface-card` + 变体修饰符 |
| 标签 / 徽章 | `.pill`（+ `data-tone="accent"` 表示强调） |
| 图标按钮 | `.icon-btn` + 尺寸（`--sm`）+ 形状（`--round`） |
| 文本链接 | `.underline-link` 或 `.prose` 内的普通 `<a>` |
| 章节标签 | `.eyebrow` |
| 焦点环 | `.focus-accent` |

### 示例：创建一个新卡片组件

```astro
<div class="surface-card surface-card--soft p-6">
    <span class="eyebrow">Category</span>
    <h3 class="text-lg font-bold mt-2">Title</h3>
    <p class="text-secondary mt-1">Description text...</p>
    <div class="flex gap-2 mt-4">
        <span class="pill" data-tone="accent">Tag</span>
    </div>
</div>
```

### 关键约定

1. 所有间距使用 `--space-*` 刻度（4px 递增至 48px）
2. 圆角遵循 `--radius-*` 刻度（绝不使用任意值）
3. 阴影仅限 `shadow-soft` 和 `shadow-strong`
4. 过渡使用 `--transition-*` token（绝不用原始 `0.3s ease`）
5. 深色模式由 CSS 变量处理 —— 组件中无需 JS 主题逻辑
6. 表格应包含 `data-card-mode="cards"` 以支持响应式移动端布局
