import * as fs from 'fs';
import * as path from 'path';

export function mkdir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function cpdir(src: string, dest: string): void {
    mkdir(dest);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        entry.isDirectory() ? cpdir(s, d) : fs.copyFileSync(s, d);
    }
}
