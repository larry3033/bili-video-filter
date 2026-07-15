import { clamp } from '../utils';

// ========== 8 参数定义 ==========
export interface FilterParams {
    exposure: number;    // -100 ~ 100  曝光
    contrast: number;    // -100 ~ 100  对比
    highlights: number;  // -100 ~ 100  亮点
    shadows: number;     // -100 ~ 100  阴影
    temperature: number; // -100 ~ 100  温度 (-暖 +冷)
    saturation: number;  // -100 ~ 100  强度
    sharpness: number;   //    0 ~ 100  锐化
    clarity: number;     //    0 ~ 100  明朗
}

export const DEFAULT_PARAMS: FilterParams = {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0,
    temperature: 0, saturation: 0, sharpness: 0, clarity: 0,
};

export const PARAM_LABELS: Record<keyof FilterParams, string> = {
    exposure: '曝光', contrast: '对比', highlights: '亮点',
    shadows: '阴影', temperature: '温度', saturation: '强度',
    sharpness: '锐化', clarity: '明朗',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const FILTER_ID = 'bvf-filter';
const TABLE_SIZE = 256;

export class FilterEngine {
    private filter: SVGFilterElement;
    private feTemp: SVGFEColorMatrixElement;
    private feSat: SVGFEColorMatrixElement;
    private feTransfer: SVGFEComponentTransferElement;
    private feSharp: SVGFEConvolveMatrixElement;
    private funcR: SVGFEFuncRElement;
    private funcG: SVGFEFuncGElement;
    private funcB: SVGFEFuncBElement;

    params: FilterParams = { ...DEFAULT_PARAMS };
    private video: HTMLVideoElement | null = null;

    constructor() {
        // 隐藏 SVG 容器
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';

        this.filter = document.createElementNS(SVG_NS, 'filter');
        this.filter.setAttribute('id', FILTER_ID);
        this.filter.setAttribute('color-interpolation-filters', 'sRGB');

        // ---- 节点 1: 色温 (feColorMatrix) ----
        this.feTemp = document.createElementNS(SVG_NS, 'feColorMatrix');
        this.feTemp.setAttribute('in', 'SourceGraphic');
        this.feTemp.setAttribute('type', 'matrix');
        this.feTemp.setAttribute('result', 'temp');
        this.feTemp.setAttribute('values', this.buildTempMatrix(0));

        // ---- 节点 2: 饱和度 (feColorMatrix) ----
        this.feSat = document.createElementNS(SVG_NS, 'feColorMatrix');
        this.feSat.setAttribute('in', 'temp');
        this.feSat.setAttribute('type', 'saturate');
        this.feSat.setAttribute('result', 'sat');
        this.feSat.setAttribute('values', '1');

        // ---- 节点 3: 曝光/对比/高光/阴影/明朗 (feComponentTransfer, 合并到一张表) ----
        this.feTransfer = document.createElementNS(SVG_NS, 'feComponentTransfer');
        this.feTransfer.setAttribute('in', 'sat');
        this.feTransfer.setAttribute('result', 'tonal');

        this.funcR = document.createElementNS(SVG_NS, 'feFuncR');
        this.funcR.setAttribute('type', 'table');
        this.funcG = document.createElementNS(SVG_NS, 'feFuncG');
        this.funcG.setAttribute('type', 'table');
        this.funcB = document.createElementNS(SVG_NS, 'feFuncB');
        this.funcB.setAttribute('type', 'table');

        const identity = this.buildIdentityTable();
        this.funcR.setAttribute('tableValues', identity);
        this.funcG.setAttribute('tableValues', identity);
        this.funcB.setAttribute('tableValues', identity);

        this.feTransfer.appendChild(this.funcR);
        this.feTransfer.appendChild(this.funcG);
        this.feTransfer.appendChild(this.funcB);

        // ---- 节点 4: 锐化 (feConvolveMatrix) ----
        this.feSharp = document.createElementNS(SVG_NS, 'feConvolveMatrix');
        this.feSharp.setAttribute('in', 'tonal');
        this.feSharp.setAttribute('order', '3');
        this.feSharp.setAttribute('kernelMatrix', '0 0 0  0 1 0  0 0 0');
        this.feSharp.setAttribute('divisor', '1');
        this.feSharp.setAttribute('preserveAlpha', 'true');

        // ---- 组装 ----
        this.filter.appendChild(this.feTemp);
        this.filter.appendChild(this.feSat);
        this.filter.appendChild(this.feTransfer);
        this.filter.appendChild(this.feSharp);
        svg.appendChild(this.filter);
        document.body.appendChild(svg);
    }

    // ========== 绑定视频 ==========

    attach(video: HTMLVideoElement): void {
        this.video = video;
        video.style.filter = `url(#${FILTER_ID})`;
    }

    detach(): void {
        if (this.video) {
            this.video.style.filter = '';
            this.video = null;
        }
    }

    // ========== 参数更新 ==========

    setParam<K extends keyof FilterParams>(key: K, value: number): void {
        this.params[key] = value;
        this.applyParams();
    }

    setAll(params: FilterParams): void {
        this.params = { ...params };
        this.applyParams();
    }

    // ========== 将参数推入 SVG ==========

    /** 公开版: 供外部直接触发应用 (如 restoreState) */
    applyParamsDirect(): void {
        this.applyParams();
    }

    private applyParams(): void {
        const p = this.params;

        // 1. 色温矩阵
        this.feTemp.setAttribute('values', this.buildTempMatrix(p.temperature));

        // 2. 饱和度
        const sat = 1 + p.saturation / 50;
        this.feSat.setAttribute('values', String(clamp(sat, 0, 3)));

        // 3. 合并调色曲线
        const table = this.buildTonalTable(
            p.exposure / 100, p.contrast / 100,
            p.highlights / 100, p.shadows / 100, p.clarity / 100,
        );
        const tableStr = table.join(' ');
        this.funcR.setAttribute('tableValues', tableStr);
        this.funcG.setAttribute('tableValues', tableStr);
        this.funcB.setAttribute('tableValues', tableStr);

        // 4. 锐化核
        const k = p.sharpness / 100 * 0.5;
        this.setSharpKernelRaw(
            -k, -k, -k,
            -k, 1 + 4 * k, -k,
            -k, -k, -k,
        );
    }

    // ========== 原始参数直设 (供高级面板调用) ==========

    /** 直接设置色温对角矩阵 */
    setTempRaw(r: number, g: number, b: number): void {
        const values = [
            r, 0, 0, 0, 0,
            0, g, 0, 0, 0,
            0, 0, b, 0, 0,
            0, 0, 0, 1, 0,
        ].map(n => n.toFixed(4)).join(' ');
        this.feTemp.setAttribute('values', values);
    }

    /** 直接设置饱和度 */
    setSatRaw(v: number): void {
        this.feSat.setAttribute('values', String(clamp(v, 0, 3)));
    }

    /** 直接设置色调映射表 */
    setTonalTableRaw(table: number[]): void {
        const s = table.map(n => n.toFixed(4)).join(' ');
        this.funcR.setAttribute('tableValues', s);
        this.funcG.setAttribute('tableValues', s);
        this.funcB.setAttribute('tableValues', s);
    }

    /** 获取当前色调映射表 */
    getTonalTableRaw(): number[] {
        const raw = this.funcR.getAttribute('tableValues') || this.buildIdentityTable();
        return raw.split(/\s+/).map(Number);
    }

    /** 直接设置锐化核 3×3 */
    setSharpKernelRaw(
        k00: number, k01: number, k02: number,
        k10: number, k11: number, k12: number,
        k20: number, k21: number, k22: number,
    ): void {
        this.feSharp.setAttribute('kernelMatrix',
            `${k00.toFixed(3)} ${k01.toFixed(3)} ${k02.toFixed(3)} ` +
            `${k10.toFixed(3)} ${k11.toFixed(3)} ${k12.toFixed(3)} ` +
            `${k20.toFixed(3)} ${k21.toFixed(3)} ${k22.toFixed(3)}`);
    }

    /** 获取当前锐化核 (9 个值) */
    getSharpKernelRaw(): number[] {
        const raw = this.feSharp.getAttribute('kernelMatrix') || '0 0 0 0 1 0 0 0 0';
        return raw.split(/\s+/).map(Number);
    }

    /** 获取当前色温对角线值 */
    getTempDiagRaw(): { r: number; g: number; b: number } {
        const raw = this.feTemp.getAttribute('values') || '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0';
        const v = raw.split(/\s+/).map(Number);
        return { r: v[0], g: v[6], b: v[12] };
    }

    /** 获取当前饱和度 */
    getSatRaw(): number {
        return parseFloat(this.feSat.getAttribute('values') || '1');
    }

    /** 重建色调映射表 (简化参数 → 256 表) */
    rebuildTonalTable(gamma: number, slope: number, intercept: number, highlight: number, shadow: number, clarity: number): void {
        const table: number[] = [];
        for (let i = 0; i < TABLE_SIZE; i++) {
            let v = i / (TABLE_SIZE - 1);
            // gamma
            if (gamma !== 1) v = Math.pow(v, gamma);
            // slope + intercept
            v = v * slope + intercept;
            // highlight
            if (highlight !== 0) {
                const w = Math.max(0, (v - 0.5) * 2);
                v += highlight * 0.4 * w * w;
            }
            // shadow
            if (shadow !== 0) {
                const w = Math.max(0, 1 - v * 2);
                v += shadow * 0.5 * w * w;
            }
            // clarity
            if (clarity > 0) {
                const w = 1 - Math.abs(v - 0.5) * 2;
                v += (v - 0.5) * clarity * 0.6 * w;
            }
            v = clamp(v, 0, 1);
            table.push(v);
        }
        this.setTonalTableRaw(table);
    }

    // ========== 色温矩阵 ==========

    private buildTempMatrix(temp: number): string {
        // temp: -100(暖) ~ +100(冷)
        const t = clamp(temp, -100, 100) / 100;

        // 暖色: 加红减蓝; 冷色: 减红加蓝
        const r = 1 + t * -0.35;  // 暖→红+  冷→红-
        const g = 1;               // 绿通道不变
        const b = 1 + t * 0.35;   // 暖→蓝-  冷→蓝+

        // feColorMatrix 4×5 格式: R'=rR*R+rG*G+rB*B  G'=gR*R+gG*G+gB*G  B'=bR*R+bG*G+bB*B
        return [
            r, 0, 0, 0, 0,   // R 通道
            0, 1, 0, 0, 0,   // G 通道
            0, 0, b, 0, 0,   // B 通道
            0, 0, 0, 1, 0,   // A 通道
        ].map(n => n.toFixed(4)).join(' ');
    }

    // ========== 调色查找表 ==========

    private buildIdentityTable(): string {
        return Array.from({ length: TABLE_SIZE }, (_, i) =>
            (i / (TABLE_SIZE - 1)).toFixed(4)
        ).join(' ');
    }

    private buildTonalTable(
        exp: number,      // -1 ~ 1
        cont: number,     // -1 ~ 1
        high: number,     // -1 ~ 1
        shad: number,     // -1 ~ 1
        clar: number,     // 0 ~ 1
    ): number[] {
        const table: number[] = [];

        for (let i = 0; i < TABLE_SIZE; i++) {
            let v = i / (TABLE_SIZE - 1);

            // --- 曝光 (gamma 偏移) ---
            if (exp !== 0) {
                const gamma = exp > 0
                    ? 1 - exp * 0.5   // 曝光+ → gamma<1 → 变亮, 范围 0.5~1
                    : 1 / (1 + exp * 0.5); // 曝光- → gamma>1 → 变暗, 范围 1~2
                v = Math.pow(v, gamma);
            }

            // --- 对比 (S 曲线) ---
            if (cont !== 0) {
                const slope = 1 + cont; // 0 ~ 2
                v = (v - 0.5) * slope + 0.5;
                v = clamp(v, 0, 1);
            }

            // --- 阴影 (只影响低亮度) ---
            if (shad !== 0) {
                // 在暗部加偏移，越暗影响越大
                const shadowWeight = Math.max(0, 1 - v * 2); // v=0→1, v=0.5→0
                v += shad * 0.5 * shadowWeight * shadowWeight;
            }

            // --- 亮点 (只影响高亮度) ---
            if (high !== 0) {
                // 在高亮部加偏移，越亮影响越大
                const highlightWeight = Math.max(0, (v - 0.5) * 2); // v=0.5→0, v=1→1
                v += high * 0.4 * highlightWeight * highlightWeight;
            }

            // --- 明朗 (中调对比: 拉大中间值差距) ---
            if (clar > 0) {
                // S 曲线只作用于中调
                const midWeight = 1 - Math.abs(v - 0.5) * 2; // v=0.5→1, v=0/1→0
                v = v + (v - 0.5) * clar * 0.6 * midWeight;
            }

            v = clamp(v, 0, 1);
            table.push(v);
        }

        return table;
    }
}
