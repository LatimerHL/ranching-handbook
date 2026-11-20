import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

const root = dirname(fileURLToPath(import.meta.url));
const knowledge = resolve(process.argv[2] ?? join(root, 'knowledge'));
const dist = join(root, 'dist');
const repository = 'https://github.com/LatimerHL/RanchingFieldNotes';
const editions = { 'game-1': '一代', 'game-2': '二代', general: '通用' };
const categories = {
  guides: '攻略', slimes: '史莱姆', world: '地图与探索', ranch: '牧场与设施',
  resources: '食物与资源', science: '史莱姆科技', weather: '天气',
  versions: '版本与 DLC', lore: '人物与世界观', settings: '设置与支持', other: '其他资料',
};

const featured = new Map([
  ['game-1/guide/farming-guide.md', { copy: '从牧栏、食物到结晶市场，理顺一代的养殖流程。', tone: 'peach', stop: '## 大型史莱姆杂交攻略' }],
  ['game-1/guide/map-unlock-guide.md', { copy: '查史莱姆钥匙、区域入口与遗迹解谜。', tone: 'sage' }],
  ['game-2/guide/farming-guide.md', { copy: '查温室设施、量子无人机与天气机制。', tone: 'lilac' }],
  ['game-2/tips.md', { copy: '速查结晶时效、天气、饲养和资源机制。' }],
  ['game-2/guide/ancient-teleporter.md', { copy: '了解彩虹岛的跨区域传送设施。' }],
  ['general/terminology.md', { copy: '对照两代的简繁中文名、英文名和常用别称。' }],
]);

function categoryFor(path) {
  const [, group] = path.split('/');
  if (['guide', 'tips.md', 'tutorial'].includes(group)) return 'guides';
  if (['science', 'blueprints'].includes(group)) return 'science';
  if (['game-versions', 'dlc'].includes(group)) return 'versions';
  if (['mail', 'exchange', 'npc.md', 'world-lore.md', 'trivia.md'].includes(group)) return 'lore';
  if (group === 'options' || group.includes('support')) return 'settings';
  return Object.hasOwn(categories, group) ? group : 'other';
}

async function entriesIn(folder) {
  const result = [];
  for (const entry of await readdir(join(knowledge, folder), { withFileTypes: true })) {
    const path = posix.join(folder, entry.name);
    if (entry.isDirectory()) {
      result.push(...await entriesIn(path));
    } else if (entry.isFile() && path.endsWith('.md')) {
      const text = (await readFile(join(knowledge, path), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      const title = /^#\s+(.+)$/m.exec(text)?.[1].trim();
      if (!title) throw new Error('Missing H1 in ' + path);
      result.push({ path, title, body: text.replace(/^#\s+.+$/m, '').trim(), edition: path.split('/')[0], category: categoryFor(path) });
    }
  }
  return result;
}

const entries = (await Promise.all(Object.keys(editions).map(entriesIn))).flat();
entries.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN') || a.path.localeCompare(b.path));
const known = new Map(entries.map(entry => [entry.path, entry]));
for (const path of featured.keys()) {
  if (!known.has(path)) throw new Error('Featured article missing: ' + path);
}

const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const localArticle = path => 'read/' + path.replace(/\.md$/, '.html');
const sourceLink = path => repository + '/blob/main/' + path.split('/').map(encodeURIComponent).join('/');
const linkFor = path => featured.has(path) ? localArticle(path) : sourceLink(path);
const markdown = new MarkdownIt({ html: false });

function articleContent(entry, prefix) {
  const { stop } = featured.get(entry.path);
  const text = stop ? entry.body.split('\n' + stop + '\n', 1)[0].trimEnd() : entry.body;
  const env = {};
  const tokens = markdown.parse(text, env);
  const slugger = new GithubSlugger();
  slugger.slug(entry.title);
  const outline = [];
  for (const [i, token] of tokens.entries()) {
    if (token.type === 'heading_open') {
      const title = tokens[i + 1].children.map(child => child.content).join('');
      const id = slugger.slug(title);
      token.attrSet('id', id);
      if (token.tag === 'h2') outline.push({ title, id });
    }
    for (const child of token.children ?? []) {
      if (child.type !== 'link_open') continue;
      const href = child.attrGet('href');
      if (!href || /^[a-z][a-z\d+.-]*:|^\/\/|^#/.test(href)) continue;
      const [rawPath, hash = ''] = href.split(/#(.*)/s);
      const target = posix.normalize(posix.join(posix.dirname(entry.path), decodeURI(rawPath)));
      const suffix = hash ? '#' + hash : '';
      child.attrSet('href', featured.has(target) ? prefix + localArticle(target) + suffix : sourceLink(target) + suffix);
    }
  }
  return { outline, html: markdown.renderer.render(tokens, markdown.options, env) };
}

function shell({ title, description, prefix = './', main, scripts = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#f8f5eb">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
  <a class="skip" href="#main">跳至主要内容</a>
  <header class="top">
    <nav class="container top-inner" aria-label="主导航">
      <a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true"></span>牧场笔记</a>
      <div class="nav-links">
        <a href="${prefix}#featured">精选攻略</a>
        <a href="${prefix}#library">资料目录</a>
        <a class="repo-link" href="${repository}">GitHub</a>
      </div>
    </nav>
  </header>
  ${main}
  <footer class="foot">
    <div class="container footer-inner">
      <a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true"></span>牧场笔记</a>
      <div>
        <p>牧场笔记是独立的非官方粉丝作品。游戏权利归 Monomi Park, LLC 所有。</p>
        <p>“牧场笔记” is unofficial Fan Content permitted under the <a href="https://www.slimerancher.com/fan-content-policy/">Fan Content Policy</a>. Not approved/endorsed by Monomi Park. Portions of the materials used are property of Monomi Park, LLC. ©Monomi Park LLC.</p>
      </div>
    </div>
  </footer>
  ${scripts}
</body>
</html>`;
}

const cards = [...featured.entries()].filter(([, details]) => details.tone).map(([path, details]) => {
  const entry = known.get(path);
  return `<a class="feature ${details.tone}" href="${localArticle(path)}">
    <span class="feature-meta">${editions[entry.edition]} · ${categories[entry.category]}</span>
    <h3>${escape(entry.title.replace(/（.*）$/, ''))}</h3>
    <p>${escape(details.copy)}</p>
  </a>`;
}).join('\n');

const options = Object.entries(categories).map(([key, name]) => `<option value="${key}">${name}</option>`).join('');

const index = shell({
  title: '牧场笔记 · 中文手册',
  description: '《史莱姆牧场》系列中文资料手册，提供一代、二代和通用资料索引。',
  main: `<main id="main" class="container">
    <section class="hero" aria-labelledby="welcome">
      <div class="hero-copy">
        <p class="kicker">SLIME RANCHER FIELD GUIDE</p>
        <h1 id="welcome">牧场笔记</h1>
        <p class="subtitle">《史莱姆牧场》中文手册</p>
        <p class="intro">查史莱姆、找食物、解锁新区域。<br>一代与二代的攻略和资料都在这里。</p>
        <a class="primary" href="#library">查找资料</a>
      </div>
      <figure class="hero-image">
        <img src="./assets/ranch.webp" width="1320" height="880" alt="夕阳下坐落在红色山崖与草地之间的小牧场">
        <figcaption>牧场风景插画</figcaption>
      </figure>
    </section>
    <section id="featured" class="band" aria-labelledby="featured-title">
      <h2 id="featured-title">精选攻略</h2>
      <div class="featured-grid">${cards}</div>
    </section>
    <section id="library" class="band library" aria-labelledby="library-title">
      <div class="section-head">
        <div><h2 id="library-title">资料目录</h2><p>按作品和主题筛选，或用中文、英文名称查找。</p></div>
        <a href="${repository}/blob/main/_INDEX.md">GitHub 原始索引</a>
      </div>
      <form id="filters" class="filters" role="search" hidden>
        <label class="query">搜索条目<input type="search" id="query" placeholder="例如 粉红史莱姆、Plort 或 量子无人机" autocomplete="off"></label>
        <label>作品<select id="edition"><option value="">全部作品</option><option value="game-1">一代</option><option value="game-2">二代</option><option value="general">通用</option></select></label>
        <label>主题<select id="category"><option value="">全部主题</option>${options}</select></label>
      </form>
      <p id="result-count" class="result-count" role="status"></p>
      <ul id="result-list" class="result-list"></ul>
      <button id="more" class="more" type="button" hidden>显示更多</button>
      <noscript><p>可以通过上方的 GitHub 原始索引浏览全部资料。</p></noscript>
    </section>
  </main>`,
  scripts: '<script type="module" src="./assets/catalog.js"></script>',
});

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
await writeFile(join(dist, 'index.html'), index);
const catalog = entries.map(({ title, path, edition, category }) => ({
  title, url: linkFor(path), edition, category,
  editionName: editions[edition], categoryName: categories[category],
  inHandbook: featured.has(path),
}));
await writeFile(join(dist, 'assets', 'catalog.json'), JSON.stringify(catalog));

for (const [path, { copy, stop }] of featured) {
  const entry = known.get(path);
  const output = localArticle(path);
  const prefix = '../'.repeat(output.split('/').length - 1);
  const { outline, html } = articleContent(entry, prefix);
  const toc = outline.map(({ title, id }) => `<li><a href="#${encodeURIComponent(id)}">${escape(title)}</a></li>`).join('');
  const main = `<main id="main" class="container article-page">
    <div class="article-head">
      <p class="breadcrumbs"><a href="${prefix}#library">资料目录</a><span aria-hidden="true">/</span>${editions[entry.edition]} · ${categories[entry.category]}</p>
      <h1>${escape(entry.title)}</h1>
      <p class="article-intro">${escape(copy)}</p>
      <a href="${sourceLink(path)}">在 GitHub 查看${stop ? '全文' : '原文'}</a>
    </div>
    <div class="reading-grid">
      <nav class="outline" aria-label="本文目录"><p>本文目录</p><ul>${toc}</ul></nav>
      <article class="prose">${html}</article>
    </div>
  </main>`;
  const destination = join(dist, output);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, shell({ title: entry.title + ' · 牧场笔记', description: copy, prefix, main }));
}

console.log('Built ' + catalog.length + ' catalog entries and ' + featured.size + ' articles.');
