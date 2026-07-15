import { FilterEngine, FilterParams, DEFAULT_PARAMS, PARAM_LABELS } from './filter-engine';
import { PRESETS } from './presets';
import { log } from '../utils';

// ========== 持久化 ==========
const STORAGE_KEY = 'bvf_state';

interface SavedState {
    presetId: string;
    params: FilterParams;
}

function loadState(): SavedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}

function saveState(state: SavedState): void {
    try {
        // 确保 params 完整: 合并默认值防止缺字段
        const fullParams: FilterParams = { ...DEFAULT_PARAMS, ...state.params };
        const toSave: SavedState = { presetId: state.presetId, params: fullParams };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        log(`已保存: ${state.presetId || '自定义'} (${Object.values(fullParams).join(',')})`);
    } catch (e) {
        log(`保存失败: ${e}`);
    }
}

// slider 配置
interface SliderConfig {
    key: keyof FilterParams;
    label: string;
    min: number;
    max: number;
    step: number;
    defaultVal: number;
}

const SLIDER_CONFIGS: SliderConfig[] = [
    { key: 'exposure',    label: '曝光', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'contrast',    label: '对比', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'highlights',  label: '亮点', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'shadows',     label: '阴影', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'temperature', label: '温度', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'saturation',  label: '强度', min: -100, max: 100, step: 1, defaultVal: 0 },
    { key: 'sharpness',   label: '锐化', min:    0, max: 100, step: 1, defaultVal: 0 },
    { key: 'clarity',     label: '明朗', min:    0, max: 100, step: 1, defaultVal: 0 },
];

// 单例
let panel: BVFPanel | null = null;

export function getPanel(): BVFPanel | null { return panel; }

export class BVFPanel {
    private engine: FilterEngine;
    private timer: number | null = null;
    private activePreset = '';

    // DOM refs
    private toggle!: HTMLElement;
    private mainPanel!: HTMLElement;
    private advPanel!: HTMLElement;
    private presetGrid!: HTMLElement;
    private slidersContainer!: HTMLElement;
    private advancedToggle!: HTMLElement;

    // slider 元素映射
    private sliderEls: Map<string, {
        slider: HTMLInputElement;
        input: HTMLInputElement;
        reset: HTMLElement;
    }> = new Map();

    // 高级输入
    private advInputs: Record<string, HTMLInputElement> = {};

    constructor(engine: FilterEngine) {
        this.engine = engine;
        panel = this;
    }

    init(): void {
        const ctrl = document.querySelector<HTMLElement>('.bpx-player-ctrl-vfilter');
        if (!ctrl) throw new Error('滤镜按钮未找到');

        this.toggle = ctrl.querySelector<HTMLElement>('.bpx-player-ctrl-btn-icon')!;

        // 把两个面板从控制栏内移到 document.body，避免全屏时被 overflow:hidden 裁切
        const mainPanel = ctrl.querySelector('#bvf-main-panel')!;
        const advPanel = ctrl.querySelector('#bvf-adv-panel')!;
        document.body.appendChild(mainPanel);
        document.body.appendChild(advPanel);
        this.mainPanel = mainPanel as HTMLElement;
        this.advPanel = advPanel as HTMLElement;

        this.presetGrid = this.mainPanel.querySelector('#bvf-preset-grid')!;
        this.slidersContainer = this.mainPanel.querySelector('#bvf-sliders')!;
        this.advancedToggle = this.mainPanel.querySelector('#bvf-advanced-toggle')!;

        // 构建 UI
        this.buildPresets();
        this.buildSliders();
        this.bindAdvanced();

        // 事件
        this.toggle.addEventListener('mouseenter', () => this.onToggleEnter());
        this.toggle.addEventListener('mouseleave', () => this.onToggleLeave());
        this.mainPanel.addEventListener('mouseenter', () => this.onPanelEnter());
        this.mainPanel.addEventListener('mouseleave', () => this.onPanelLeave());
        this.advPanel.addEventListener('mouseenter', () => this.onPanelEnter());
        this.advPanel.addEventListener('mouseleave', () => this.onPanelLeave());

        // 窗口 resize 时重算位置
        window.addEventListener('resize', () => {
            if (this.mainPanel.style.display === 'flex') this.updatePanelPosition();
        });

        // 恢复上次状态 (跨视频切换 / 刷新页面)
        this.restoreState();
    }

    // ========== 展开/折叠面板 ==========

    private useTimer(cb: () => void, delay = 300): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = window.setTimeout(cb, delay);
    }

    private showPanel(): void {
        if (this.mainPanel.style.display === 'flex') return;
        this.mainPanel.style.display = 'flex';
        this.updatePanelPosition();
    }

    private hidePanel(): void {
        if (this.mainPanel.style.display === 'none') return;
        this.mainPanel.style.display = 'none';
        this.hideAdvPanel();
    }

    private hideAdvPanel(): void {
        this.advPanel.style.display = 'none';
        const chev = this.advancedToggle.querySelector('.bvf-chevron');
        if (chev) chev.textContent = '▸';
        this.advancedToggle.classList.remove('active');
    }

    private onToggleEnter(): void {
        this.useTimer(() => this.showPanel());
    }
    private onToggleLeave(): void {
        this.useTimer(() => this.hidePanel());
    }
    private onPanelEnter(): void {
        if (this.timer) clearTimeout(this.timer);
    }
    private onPanelLeave(): void {
        this.useTimer(() => this.hidePanel());
    }

    private updatePanelPosition(): void {
        if (!this.toggle) return;
        const tr = this.toggle.getBoundingClientRect();

        // 面板宽度 (CSS 固定值)
        const mainW = 290;
        const advW = 250;
        const gap = 6;

        // 用 fixed 定位，相对于视口 — 避免全屏时被 overflow:hidden 裁切
        const mainBottom = window.innerHeight - tr.top + 4;
        const mainRight = window.innerWidth - tr.right - (tr.width - mainW) / 2;

        this.mainPanel.style.position = 'fixed';
        this.mainPanel.style.bottom = `${mainBottom}px`;
        this.mainPanel.style.right = `${mainRight}px`;
        this.mainPanel.style.top = 'auto';
        this.mainPanel.style.left = 'auto';

        // 侧面板：紧贴主面板左侧
        this.advPanel.style.position = 'fixed';
        this.advPanel.style.bottom = `${mainBottom}px`;
        this.advPanel.style.right = `${mainRight + mainW + gap}px`;
        this.advPanel.style.top = 'auto';
        this.advPanel.style.left = 'auto';
    }

    // ========== 构建预设按钮 ==========

    private buildPresets(): void {
        this.presetGrid.innerHTML = '';
        for (const p of PRESETS) {
            const btn = document.createElement('button');
            btn.className = 'bvf-preset-btn';
            btn.title = p.desc;
            btn.innerHTML = `<span class="bvf-preset-icon">${p.icon}</span><span>${p.name}</span>`;
            btn.addEventListener('click', () => this.applyPreset(p.id));
            this.presetGrid.appendChild(btn);
        }
    }

    applyPreset(id: string): void {
        const preset = PRESETS.find(p => p.id === id);
        if (!preset) return;

        this.activePreset = id;
        this.engine.setAll(preset.params);

        // 同步 slider + input
        for (const [key, { slider, input }] of this.sliderEls) {
            const v = preset.params[key as keyof FilterParams];
            slider.value = String(v);
            input.value = String(v);
        }

        // 更新预设按钮状态
        this.presetGrid.querySelectorAll('.bvf-preset-btn').forEach((btn, i) => {
            btn.classList.toggle('active', PRESETS[i].id === id);
        });

        // 同步高级输入
        this.syncAdvancedInputs();

        // 持久化
        this.persist(id);

        log(`预设: ${preset.name}`);
    }

    // ========== 构建参数滑条 ==========

    private buildSliders(): void {
        this.slidersContainer.innerHTML = '';
        for (const cfg of SLIDER_CONFIGS) {
            const row = document.createElement('div');
            row.className = 'bvf-slider-row';

            // label
            const label = document.createElement('span');
            label.className = 'bvf-slider-label';
            label.textContent = cfg.label;

            // slider
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'bvf-slider-input';
            slider.min = String(cfg.min);
            slider.max = String(cfg.max);
            slider.step = String(cfg.step);
            slider.value = String(cfg.defaultVal);
            slider.dataset.key = cfg.key;

            // 数字输入框
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'bvf-slider-num';
            input.value = String(cfg.defaultVal);
            input.min = String(cfg.min);
            input.max = String(cfg.max);
            input.step = String(cfg.step);
            input.title = cfg.label;

            // 一键还原按钮
            const resetBtn = document.createElement('button');
            resetBtn.className = 'bvf-slider-reset';
            resetBtn.title = `重置${cfg.label}`;
            resetBtn.textContent = '↺';

            // ---- 事件 ----

            // 滑条 → 输入框 + 引擎
            slider.addEventListener('input', () => {
                const v = parseInt(slider.value, 10);
                input.value = String(v);
                this.sliderChanged(cfg.key, v);
            });

            // 双击重置
            slider.addEventListener('dblclick', () => {
                slider.value = String(cfg.defaultVal);
                input.value = String(cfg.defaultVal);
                this.sliderChanged(cfg.key, cfg.defaultVal);
            });

            // 输入框 → 滑条 + 引擎
            input.addEventListener('input', () => {
                let v = parseInt(input.value, 10);
                if (isNaN(v)) return;
                v = Math.max(cfg.min, Math.min(cfg.max, v));
                input.value = String(v);
                slider.value = String(v);
                this.sliderChanged(cfg.key, v);
            });

            // 失焦格式化
            input.addEventListener('blur', () => {
                let v = parseInt(input.value, 10);
                if (isNaN(v)) v = cfg.defaultVal;
                v = Math.max(cfg.min, Math.min(cfg.max, v));
                input.value = String(v);
                slider.value = String(v);
                this.sliderChanged(cfg.key, v);
            });

            // 回车确认
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
            });

            // 滚轮微调
            input.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -cfg.step : cfg.step;
                let v = (parseInt(input.value, 10) || cfg.defaultVal) + delta;
                v = Math.max(cfg.min, Math.min(cfg.max, v));
                input.value = String(v);
                slider.value = String(v);
                this.sliderChanged(cfg.key, v);
            });

            // 一键还原
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                slider.value = String(cfg.defaultVal);
                input.value = String(cfg.defaultVal);
                this.sliderChanged(cfg.key, cfg.defaultVal);
            });

            row.appendChild(label);
            row.appendChild(slider);
            row.appendChild(input);
            row.appendChild(resetBtn);
            this.slidersContainer.appendChild(row);

            this.sliderEls.set(cfg.key, { slider, input, reset: resetBtn });
        }
    }

    private sliderChanged(key: string, value: number): void {
        this.engine.setParam(key as keyof FilterParams, value);
        this.activePreset = ''; // 手动调节后取消预设高亮
        this.presetGrid.querySelectorAll('.bvf-preset-btn').forEach(b => b.classList.remove('active'));
        this.syncAdvancedInputs();
        this.persist(''); // 手动调参后保存完整参数
    }

    // ========== 高级区 ==========

    // 脏标记: 用户是否做过任何主动修改 (防止未操作就被覆盖)
    private dirty = false;

    // 高级输入 ID 列表 (除了 kernel 3×3 动态生成)
    private readonly ADV_IDS = [
        'bvf-adv-temp-r', 'bvf-adv-temp-g', 'bvf-adv-temp-b',
        'bvf-adv-sat',
        'bvf-adv-gamma', 'bvf-adv-slope', 'bvf-adv-intercept',
        'bvf-adv-highlight', 'bvf-adv-shadow', 'bvf-adv-clarity',
    ];
    // kernel 3×3 坐标
    private readonly KERNEL_IDS = [
        'bvf-k-00', 'bvf-k-01', 'bvf-k-02',
        'bvf-k-10', 'bvf-k-11', 'bvf-k-12',
        'bvf-k-20', 'bvf-k-21', 'bvf-k-22',
    ];

    private bindAdvanced(): void {
        // 展开/折叠侧面板
        this.advancedToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const hidden = this.advPanel.style.display === 'none';
            if (hidden) {
                this.advPanel.style.display = 'flex';
                this.syncAdvancedInputs();
                this.advancedToggle.classList.add('active');
                this.advancedToggle.querySelector('.bvf-chevron')!.textContent = '◂';
            } else {
                this.hideAdvPanel();
            }
        });

        // 普通高级输入
        for (const id of this.ADV_IDS) {
            const el = document.getElementById(id) as HTMLInputElement;
            if (!el) continue;
            this.advInputs[id] = el;
            el.addEventListener('input', () => this.applyAdvanced());
            el.addEventListener('blur', () => { this.applyAdvanced(); this.syncAdvancedInputs(); });
        }

        // kernel 3×3 输入
        for (const id of this.KERNEL_IDS) {
            const el = document.getElementById(id) as HTMLInputElement;
            if (!el) continue;
            this.advInputs[id] = el;
            el.addEventListener('input', () => this.applyAdvancedKernel());
            el.addEventListener('blur', () => { this.applyAdvancedKernel(); this.syncAdvancedInputs(); });
        }
    }

    /** 读取高级区输入 → 直接写入引擎原始参数 */
    private applyAdvanced(): void {
        // 色温
        const r = parseFloat(this.advInputs['bvf-adv-temp-r']?.value) || 1;
        const g = parseFloat(this.advInputs['bvf-adv-temp-g']?.value) || 1;
        const b = parseFloat(this.advInputs['bvf-adv-temp-b']?.value) || 1;
        this.engine.setTempRaw(r, g, b);

        // 饱和度
        const sat = parseFloat(this.advInputs['bvf-adv-sat']?.value) || 1;
        this.engine.setSatRaw(sat);

        // 色调映射表
        const gamma   = parseFloat(this.advInputs['bvf-adv-gamma']?.value) || 1;
        const slope   = parseFloat(this.advInputs['bvf-adv-slope']?.value) || 1;
        const intercept = parseFloat(this.advInputs['bvf-adv-intercept']?.value) || 0;
        const high    = parseFloat(this.advInputs['bvf-adv-highlight']?.value) || 0;
        const shad    = parseFloat(this.advInputs['bvf-adv-shadow']?.value) || 0;
        const clar    = parseFloat(this.advInputs['bvf-adv-clarity']?.value) || 0;
        this.engine.rebuildTonalTable(gamma, slope, intercept, high, shad, clar);

        this.markManual();
    }

    /** 读取 kernel 3×3 → 写入引擎 */
    private applyAdvancedKernel(): void {
        const k = this.KERNEL_IDS.map(id => parseFloat(this.advInputs[id]?.value) || 0);
        this.engine.setSharpKernelRaw(
            k[0], k[1], k[2],
            k[3], k[4], k[5],
            k[6], k[7], k[8],
        );
        this.markManual();
    }

    /** 手动修改后清除预设高亮并保存自定义状态 */
    private markManual(): void {
        this.activePreset = '';
        this.presetGrid.querySelectorAll('.bvf-preset-btn').forEach(b => b.classList.remove('active'));
        this.persist('');
    }

    /** 持久化当前状态到 localStorage (仅在用户主动操作后调用) */
    private persist(presetId: string): void {
        this.dirty = true;
        saveState({ presetId, params: { ...this.engine.params } });
    }

    /** 从 localStorage 恢复上次状态 */
    restoreState(): void {
        const saved = loadState();
        if (!saved?.params) {
            log('无已保存状态，使用默认参数');
            return;
        }

        log(`恢复状态: presetId=${saved.presetId || '(自定义)'}`);

        // 1. 合并默认值防止缺字段
        const fullParams: FilterParams = { ...DEFAULT_PARAMS, ...saved.params };

        // 2. 直接设置引擎参数 (不触发 persist 循环)
        this.engine.params = { ...fullParams };
        this.engine.applyParamsDirect();

        // 3. 同步所有 slider + 输入框
        for (const [key, { slider, input }] of this.sliderEls) {
            const v = fullParams[key as keyof FilterParams] ?? 0;
            slider.value = String(v);
            input.value = String(v);
        }

        // 4. 高亮对应预设按钮 (如果匹配)
        this.activePreset = saved.presetId || '';
        this.presetGrid.querySelectorAll('.bvf-preset-btn').forEach((btn, i) => {
            btn.classList.toggle('active', PRESETS[i].id === this.activePreset);
        });

        // 5. 同步高级区
        this.syncAdvancedInputs();

        log(`恢复完成: ${Object.values(fullParams).join(',')}`);
    }

    /** 从引擎读取原始值 → 同步所有高级输入框 */
    private syncAdvancedInputs(): void {
        // 色温
        const diag = this.engine.getTempDiagRaw();
        this.setAdvVal('bvf-adv-temp-r', diag.r);
        this.setAdvVal('bvf-adv-temp-g', diag.g);
        this.setAdvVal('bvf-adv-temp-b', diag.b);

        // 饱和度
        this.setAdvVal('bvf-adv-sat', this.engine.getSatRaw());

        // 色调映射 (从引擎 params 反算)
        const p = this.engine.params;
        const exp = p.exposure / 100;
        const gamma = exp > 0 ? 1 - exp * 0.5 : 1 / (1 + exp * 0.5);
        this.setAdvVal('bvf-adv-gamma', gamma);
        this.setAdvVal('bvf-adv-slope', 1 + p.contrast / 100);
        this.setAdvVal('bvf-adv-intercept', 0);
        this.setAdvVal('bvf-adv-highlight', p.highlights / 100);
        this.setAdvVal('bvf-adv-shadow', p.shadows / 100);
        this.setAdvVal('bvf-adv-clarity', p.clarity / 100);

        // kernel
        const kernel = this.engine.getSharpKernelRaw();
        for (let i = 0; i < 9 && i < kernel.length; i++) {
            this.setAdvVal(this.KERNEL_IDS[i], kernel[i]);
        }
    }

    private setAdvVal(id: string, v: number): void {
        const el = this.advInputs[id];
        if (el) el.value = v.toFixed(3);
    }
}
