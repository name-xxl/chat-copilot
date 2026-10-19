import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

// 版本唯一来源是 package.json：头注释 @version 与运行时 __VERSION__ 都在构建时注入
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const rawBanner = await readFile(new URL('./src/userscript-header.js', import.meta.url), 'utf8');
const banner = rawBanner.replace(/(@version\s+).*/, `$1${pkg.version}`);

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  charset: 'utf8',
  minify: false,
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: { js: banner.trimEnd() + '\n' },
  outfile: 'soul-ai-chat.user.js',
  logLevel: 'info',
});
