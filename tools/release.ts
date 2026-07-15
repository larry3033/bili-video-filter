import AdmZip from 'adm-zip';
import manifest from '../config/manifest.json' with { type: 'json' };
import * as fs from 'fs';
import * as path from 'path';

const __dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);

async function main(): Promise<void> {
    const distDir = path.resolve(__dirname, '../dist');
    const releaseDir = path.resolve(__dirname, '../release');
    if (!fs.existsSync(distDir)) { console.error('dist/ not found'); process.exit(1); }
    if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir);

    const zip = new AdmZip();
    zip.addLocalFolder(distDir, '');
    zip.writeZip(path.resolve(releaseDir, `bili-video-filter_v${manifest.version}.zip`));
    console.log('release complete.');
}

if (import.meta.main) main();
