import * as esbuild from 'esbuild';
import * as path from 'path';
import * as dir from './tools/dir.ts';
import manifest from './config/manifest.json' with { type: 'json' };
import { minify } from 'html-minifier-terser';

const __dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const distDir = path.resolve(__dirname, 'dist');
const metaDir = path.resolve(__dirname, 'config');

const htmlMinifyPlugin = {
    name: 'html-minify',
    setup(build: esbuild.PluginBuild) {
        build.onLoad({ filter: /\.html$/ }, async (args) => {
            const source = await Bun.file(args.path).text();
            const minified = await minify(source, {
                collapseWhitespace: true,
                removeComments: true,
            });
            return { contents: minified, loader: 'text' };
        });
    },
};

async function main() {
    dir.mkdir(distDir);
    dir.cpdir(metaDir, distDir);

    await esbuild.build({
        entryPoints: ['src/main.ts'],
        outfile: 'dist/main.js',
        bundle: true,
        minify: true,
        target: ['es2020'],
        plugins: [htmlMinifyPlugin],
        define: { __VERSION__: JSON.stringify(manifest.version) },
    }).catch(() => process.exit(1));

    await esbuild.build({
        entryPoints: ['src/styles/main.css'],
        outfile: 'dist/main.css',
        minify: true,
        loader: { '.css': 'css' },
    }).catch(() => process.exit(1));

    console.log('build complete.');
}

if (import.meta.main) main();
