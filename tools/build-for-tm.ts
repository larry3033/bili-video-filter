import manifest from '../config/manifest.json' with { type: 'json' };
import * as fs from 'fs';
import * as path from 'path';

const __dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);

export function build(): void {
    const script = fs.readFileSync(path.resolve(__dirname, '../dist/main.js'), 'utf-8');
    const style = fs.readFileSync(path.resolve(__dirname, '../dist/main.css'), 'utf-8');

    const result = `// ==UserScript==
// @name         B站视频滤镜
// @namespace    https://github.com/heyManNice/bili-video-filter
// @version      ${manifest.version}
// @description  SVG滤镜实时调色：8参数调节+8组预设
// @author       https://github.com/heyManNice
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/watchlater*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_addStyle
// ==/UserScript==
GM_addStyle(\`${style}\`);
${script}`;

    const outDir = path.resolve(__dirname, '../release');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    fs.writeFileSync(path.resolve(outDir, `bili-video-filter_v${manifest.version}.tampermonkey.user.js`), result, 'utf-8');
    console.log('build for tampermonkey complete.');
}

if (import.meta.main) build();
