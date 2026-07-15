/// <reference path="./global.d.ts" />

import panelHtml from './htmls/panel.html';
import { FilterEngine } from './scripts/filter-engine';
import { BVFPanel } from './scripts/panel';
import { waitUntilElementReady, insertHtmlAfterElement, printVersion, log } from './utils';

async function main() {
    const beginTime = performance.now();

    // 1. 等播放器控制栏
    const settingBtn = await waitUntilElementReady('.bpx-player-ctrl-btn.bpx-player-ctrl-setting');

    // 2. 在设置按钮旁插入滤镜按钮
    insertHtmlAfterElement(settingBtn, panelHtml);

    // 3. 等视频就绪
    let video: HTMLVideoElement | null = null;
    try {
        await waitUntilElementReady('.bpx-player-video-wrap');
        video = document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap video');
    } catch { /* ignore */ }

    // 4. 初始化滤镜引擎
    const engine = new FilterEngine();
    if (video) engine.attach(video);

    // 5. 初始化面板
    const panel = new BVFPanel(engine);
    panel.init();

    // 6. SPA 导航监听
    const container = document.querySelector('.bpx-player-video-wrap');
    if (container) {
        const observer = new MutationObserver(() => {
            const newVideo = container.querySelector<HTMLVideoElement>('video');
            if (newVideo && newVideo !== video) {
                log('视频切换，重新绑定滤镜');
                if (video) engine.detach();
                video = newVideo;
                // 延迟确保视频完全就绪后再挂滤镜+恢复状态
                setTimeout(() => {
                    engine.attach(newVideo);
                    panel.restoreState();
                }, 100);
            }
        });
        observer.observe(container, { childList: true, subtree: true });
    }

    const cost = (performance.now() - beginTime).toFixed(1);
    printVersion(__VERSION__, cost);
}

main();
