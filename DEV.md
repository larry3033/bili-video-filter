# 开发者文档

## SVG filter 参数速查

### feColorMatrix (色温)

4×5 矩阵，每行控制一个输出通道：

```
R' = m00×R + m01×G + m02×B + m03×A + m04
G' = m05×R + m06×G + m07×B + m08×A + m09
B' = m10×R + m11×G + m12×B + m13×A + m14
A' = m15×R + m16×G + m17×B + m18×A + m19
```

当前实现只用对角线 (`m00`, `m06`, `m12`) 调节色温。暖色 = 降 m12(蓝通道)，冷色 = 降 m00(红通道)。

### feComponentTransfer (色调映射)

支持 5 种 type：`identity` / `linear` / `gamma` / `table` / `discrete`。

本项目使用 `type="table"`，传入 256 个浮点值（0~1）作为 RGB 三通道共享的查找表。

查找表由 `buildTonalTable()` 计算，按顺序应用：
1. Gamma (曝光)
2. Linear slope + intercept (对比)
3. Shadow boost (阴影)
4. Highlight boost (亮点)
5. Mid-tone S-curve (明朗)

### feConvolveMatrix (锐化)

`order="3"` 表示 3×3 核。`preserveAlpha="true"` 表示只处理 RGB，不处理 Alpha。

Laplacian 锐化核: 中心 = 1 + 4k, 周围 = -k, k ∈ [0, 0.5]。

## 如何添加新预设

编辑 `src/scripts/presets.ts`:

```typescript
{
    id: 'my-preset',         // 唯一 ID (用于持久化)
    name: '我的预设',         // 显示名称
    icon: '🎯',              // emoji 图标
    desc: '描述文字',         // hover 提示
    params: {
        exposure: 10, contrast: -5, highlights: 5, shadows: 0,
        temperature: 15, saturation: 20, sharpness: 10, clarity: 5,
    },
},
```

预设按钮会自动出现在面板的 4×2 网格中。

## 如何添加新参数

1. 在 `filter-engine.ts` 的 `FilterParams` 接口里加字段
2. 在 `DEFAULT_PARAMS` 和 `PARAM_LABELS` 里补对应条目
3. 在 `panel.ts` 的 `SLIDER_CONFIGS` 数组里加滑条配置
4. 在 `applyParams()` 里实现对新参数的响应
5. 更新 `buildTonalTable()` 或添加新 SVG 原语

## 面板 DOM 结构

```
document.body
├── .bpx-player-ctrl-vfilter         ← 按钮 (在 B站控制栏内)
│   └── .bpx-player-ctrl-btn-icon    ← 齿轮图标
├── #bvf-main-panel                  ← 主面板 (移到 body, fixed 定位)
│   ├── .bvf-preset-grid             ← 8 个预设按钮 (4×2 CSS Grid)
│   ├── .bvf-sliders                 ← 8 条参数滑条 (动态构建)
│   └── .bvf-advanced-btn            ← "⚙ 高级" 切换按钮
└── #bvf-adv-panel                   ← 高级侧面板 (移到 body, fixed 定位)
    ├── feColorMatrix · 色温         ← 3 个输入框
    ├── feColorMatrix · 饱和度       ← 1 个输入框
    ├── feComponentTransfer · 色调映射 ← 6 个输入框
    └── feConvolveMatrix · 锐化核    ← 9 个输入框 (3×3 网格)
```

## localStorage 数据格式

Key: `bvf_state`

```json
{
  "presetId": "movie",
  "params": {
    "exposure": -5,
    "contrast": 18,
    "highlights": 5,
    "shadows": 15,
    "temperature": -8,
    "saturation": -15,
    "sharpness": 5,
    "clarity": 10
  }
}
```

`presetId` 为空字符串时表示自定义参数（手动调过滑条或高级区）。

## B站播放器选择器参考

| 元素 | 选择器 |
|------|------|
| 视频容器 | `.bpx-player-video-wrap` |
| 视频元素 | `.bpx-player-video-wrap video` |
| 播放器容器 | `.bpx-player-container` |
| 控制栏设置按钮 | `.bpx-player-ctrl-btn.bpx-player-ctrl-setting` |
| 屏幕模式 (data attr) | `.bpx-player-container[data-screen]` |

`data-screen` 取值: `"normal"` / `"web"` (网页全屏) / `"full"` (浏览器全屏)。
