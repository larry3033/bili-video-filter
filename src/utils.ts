export function waitUntilElementReady(selector: string): Promise<Element> {
    return new Promise((resolve, reject) => {
        let tries = 0;
        function check() {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            if (tries++ > 100) return reject(new Error(`Element ${selector} not found`));
            setTimeout(check, 300);
        }
        check();
    });
}

export function insertHtmlAfterElement(el: Element, html: string): void {
    const range = document.createRange();
    const frag = range.createContextualFragment(html);
    el.parentElement?.insertBefore(frag, el.nextSibling);
}

export function log(msg: string): void {
    console.log(`[B站视频滤镜] ${msg}`);
}

export function printVersion(version: string, cost: string): void {
    console.log(
        `%c 🎨 B站视频滤镜 v${version} %c Cost ${cost}ms`,
        'background:#f72585;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px;font-weight:bold;',
        'background:#4cc9f0;color:#003;padding:2px 6px;border-radius:0 3px 3px 0;font-weight:bold;',
    );
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
