import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './src/knowledge.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const knowledge = resolve(process.argv[2] ?? join(root, 'knowledge'));
const dist = join(root, 'dist');
const require = createRequire(import.meta.url);
const astroPackage = require.resolve('astro/package.json');
const astroCli = join(dirname(astroPackage), require(astroPackage).bin.astro);
const webFonts = {
  'mona-sans': ['index.css', 'wght-italic.css'],
  'noto-sans-sc': ['index.css'],
  'noto-sans-tc': ['index.css'],
};

const catalog = await loadCatalog(knowledge);
execFileSync(process.execPath, [astroCli, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, HANDBOOK_KNOWLEDGE_DIR: knowledge },
});

await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
for (const [name, stylesheets] of Object.entries(webFonts)) {
  const source = join(root, 'node_modules', '@fontsource-variable', name);
  const destination = join(dist, 'assets', 'fonts', name);
  await mkdir(join(destination, 'files'), { recursive: true });
  await cp(join(source, 'LICENSE'), join(destination, 'LICENSE'));
  const fontFiles = new Set();
  for (const stylesheet of stylesheets) {
    const css = await readFile(join(source, stylesheet), 'utf8');
    for (const [, file] of css.matchAll(/url\(\.\/files\/([^/)]+\.woff2)\)/g)) {
      fontFiles.add(file);
    }
    await writeFile(join(destination, stylesheet), css);
  }
  if (!fontFiles.size) throw new Error('No web font files found for ' + name);
  await Promise.all([...fontFiles].map(file => cp(join(source, 'files', file), join(destination, 'files', file))));
}
await writeFile(join(dist, 'assets', 'catalog.json'), JSON.stringify(catalog));
console.log('Built ' + catalog.length + ' catalog entries.');
