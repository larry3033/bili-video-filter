# 🎨 B站视频滤镜 (Bili Video Filter)

集成在B站播放器控制栏的**实时视频滤镜插件**，基于 SVG `<filter>` 管线实现 GPU 加速调色，零延迟。

## 功能

### 🎛️ 8 参数调色面板

每个参数配备滑条 + 数字输入框 + 一键还原按钮：

| 参数 | 范围 | SVG 实现 | 说明 |
|------|:---:|------|------|
| **曝光** | -100 ~ +100 | `feComponentTransfer` gamma | 整体亮度偏移 |
| **对比** | -100 ~ +100 | `feComponentTransfer` linear slope | S 曲线拉伸 |
| **亮点** | -100 ~ +100 | `feComponentTransfer` table (高光段) | 仅影响高光区域 |
| **阴影** | -100 ~ +100 | `feComponentTransfer` table (暗部段) | 仅影响暗部区域 |
| **温度** | -100 ~ +100 | `feColorMatrix` 4×5 对角矩阵 | 暖色 ↔ 冷色白平衡 |
| **强度** | -100 ~ +100 | `feColorMatrix` type="saturate" | 饱和度 |
| **锐化** | 0 ~ +100 | `feConvolveMatrix` 3×3 核 | 可调权重的卷积锐化 |
| **明朗** | 0 ~ +100 | `feComponentTransfer` table (中调) | 中调对比增强 (Clarity) |

### 🎬 8 组系统预设

```
┌──────────┬──────────┬──────────┬──────────┐
│ 🎬 电影   │ ☀️ 暖阳   │ ❄️ 冷冽   │ 📜 复古   │
│ 暗部·低饱和│ 暖色·柔光 │ 冷色·高对比│ 褪色·柔焦 │
├──────────┼──────────┼──────────┼──────────┤
│ ⚫ 黑白   │ 🔪 锐化   │ 🌫️ 去雾   │ 🔄 原图   │
│ 去色·层次 │ 纹理增强  │ 通透·鲜艳 │ 重置所有  │
└──────────┴──────────┴──────────┴──────────┘
```

### ⚙️ 高级侧面板

独立滑出面板，暴露全部 **19 个 SVG 原语原始参数**，按原语分组：

- **feColorMatrix · 色温** — R/G/B 三通道对角线值
- **feColorMatrix · 饱和度** — saturate 值 (0~3)
- **feComponentTransfer · 色调映射** — Gamma / 斜率 / 截距 / 高光 / 阴影 / 明朗
- **feConvolveMatrix · 锐化核** — 3×3 卷积核矩阵，每格独立输入

### 💾 状态持久化

- 所有参数自动保存到 `localStorage`
- 切换视频 (SPA) 自动恢复
- 刷新页面自动恢复
- 支持预设 + 自定义参数混合保存

---

## SVG 滤镜管线

```
SourceGraphic (视频原始画面)
    │
    ▼
feColorMatrix (type="matrix")
    │  色温: 4×5 矩阵，独立调节 R/G/B 通道增益
    │  ┌                    ┐
    │  │ rR  0   0   0   0  │
    │  │ 0   gG  0   0   0  │
    │  │ 0   0   bB  0   0  │
    │  │ 0   0   0   1   0  │
    │  └                    ┘
    ▼
feColorMatrix (type="saturate")
    │  饱和度: values="1.0" ~ "3.0"
    ▼
feComponentTransfer (type="table")
    │  色调映射: 256 级查找表
    │  合并 5 种效果于一张表:
    │  · Gamma 校正 (曝光)
    │  · Linear 斜率 + 截距 (对比)
    │  · 暗部加权提升 (阴影)
    │  · 高光加权提升 (亮点)
    │  · 中调对比增强 (明朗)
    ▼
feConvolveMatrix (order="3", preserveAlpha="true")
    │  锐化: 3×3 卷积核
    │  ┌              ┐
    │  │ -k  -k  -k  │
    │  │ -k 1+4k -k  │  k = sharpness/100 × 0.5
    │  │ -k  -k  -k  │
    │  └              ┘
    ▼
视频输出 (GPU 合成器下一个 vsync 生效, 0ms 延迟)
```

### 为什么用 SVG filter 而不是 Canvas？

| | SVG `<filter>` | Canvas 2D |
|------|:---:|:---:|
| **性能** | GPU 硬件加速 | CPU 逐帧渲染 |
| **延迟** | 0ms（浏览器合成器自动处理） | 需要 readback + 逐像素计算 |
| **代码量** | 修改 DOM 属性即可 | 需要完整渲染循环 |
| **能耗** | 忽略不计 | 4K 视频时可占满一个核 |
| **精度** | 32-bit 浮点 | 8-bit 整数 |

---

## 架构

```
src/
├── main.ts                          # 入口: 等播放器 → 注入按钮 → 初始化
├── global.d.ts                      # 类型声明 (__VERSION__, .html 模块)
├── utils.ts                         # 工具函数 (等待元素, 日志, 版本打印)
├── scripts/
│   ├── filter-engine.ts             # SVG 滤镜管线引擎
│   │   ├── 创建隐藏 SVG + <filter>
│   │   ├── 4 原语串联管线
│   │   ├── buildTonalTable() 256级查找表计算
│   │   └── 原始参数直设接口 (setTempRaw, setSatRaw, 等)
│   ├── presets.ts                   # 8 组系统预设定义
│   └── panel.ts                     # 面板 UI 逻辑
│       ├── 悬停展开/隐藏 + 定时器
│       ├── 滑条/输入框/还原按钮/滚轮 交互
│       ├── 预设按钮网格
│       ├── 高级侧面板切换
│       └── localStorage 持久化
├── htmls/
│   └── panel.html                   # 按钮 SVG 图标 + 主面板 + 侧面板 DOM
└── styles/
    └── main.css                     # 面板样式 (匹配 B站 bui-dark 主题)
```

### 信号流

```
用户操作 (滑条 / 输入框 / 预设按钮 / 高级输入)
    │
    ▼
panel.ts 事件处理
    │
    ├──→ FilterEngine.setParam()     ← 8 参数抽象层
    │       └──→ applyParams()       ← 写入 SVG filter DOM 属性
    │
    ├──→ FilterEngine.setTempRaw()   ← 高级区直设色温
    ├──→ FilterEngine.setSatRaw()    ← 高级区直设饱和度
    ├──→ FilterEngine.rebuildTonalTable() ← 高级区直设色调映射
    └──→ FilterEngine.setSharpKernelRaw() ← 高级区直设锐化核
                │
                ▼
        浏览器 GPU 合成器
           (下一帧自动生效)
```

---

## 安装

### 浏览器扩展

```bash
bun install && bun run build
```

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目 `dist/` 目录

### 油猴脚本 (Tampermonkey)

```bash
bun install && bun run build && bun run build:tm
```

将 `release/bili-video-filter_v*.tampermonkey.user.js` 拖入 Tampermonkey 管理面板。

---

## 开发

| 命令 | 说明 |
|------|------|
| `bun install` | 安装依赖 |
| `bun run build` | 构建浏览器扩展 → `dist/` |
| `bun run build:tm` | 构建油猴脚本 → `release/` |
| `bun run release` | 打包 .zip (Chrome Web Store 上传用) |

### 技术栈

| 层 | 技术 |
|------|------|
| 滤镜管线 | SVG `<filter>` (4 原语: feColorMatrix ×2 + feComponentTransfer + feConvolveMatrix) |
| 参数引擎 | TypeScript — 直接操作 SVG DOM 属性，零中间层 |
| UI 面板 | 注入 B站控制栏，CSS Grid + Flexbox |
| 构建 | esbuild + html-minifier-terser (HTML 内联压缩) |
| 存储 | `localStorage` (单 key `bvf_state`，~200 字节) |
| 运行时 | 浏览器扩展 Manifest V3 Content Script |

### 面板定位

面板使用 `position: fixed` + 视口坐标定位，挂载在 `document.body` 上，不受 B站播放器容器 `overflow: hidden` 影响。支持：
- 正常模式
- 网页全屏 (`data-screen="web"`)
- 浏览器全屏 (`data-screen="full"`)

按钮位置: 在设置按钮 (`.bpx-player-ctrl-setting`) 之后，与 B站原生的旋转按钮同级。

---

## 与 B站原生 UI 的关系

- 滤镜按钮图标使用 B站统一的 SVG 图标样式 (`.bpx-common-svg-icon`)
- 面板使用 B站标准样式类 (`.bui-panel`, `.bui-dark`)
- 配色与 B站播放器控制栏一致 (`#4cc9f0` 主色, `#f72585` 强调色)
- 面板交互方式与 B站设置面板一致 (hover 展开，离开延迟隐藏)

## 兼容性

| 浏览器 | 版本 | 状态 |
|------|------|:---:|
| Chrome / Edge | 90+ | ✅ |
| Firefox | 90+ | ✅ |
| Safari | 15+ | ✅ (SVG filter 支持) |
| Tampermonkey | 4.18+ | ✅ |

## License

MIT — 与 BCMNP ([B站治好了我的颈椎病](https://github.com/heyManNice/bili-cured-my-neck-pain)) 一致。
