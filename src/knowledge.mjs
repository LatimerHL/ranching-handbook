import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';
import { localArticle, repository } from './site.mjs';

const editions = { 'game-1': '一代', 'game-2': '二代', general: '通用' };
const categories = {
  guides: '攻略', slimes: '史莱姆', world: '地图与探索', ranch: '牧场与设施',
  resources: '食物与资源', science: '史莱姆科技', weather: '天气',
  versions: '版本与 DLC', lore: '人物与世界观', settings: '设置与支持', other: '其他资料',
};

const featured = new Map([
  ['game-1/guide/farming-guide.md', { copy: '从牧栏、食物到结晶市场，理顺一代的养殖流程。', stop: '## 大型史莱姆杂交攻略' }],
  ['game-1/guide/map-unlock-guide.md', { copy: '查史莱姆钥匙、区域入口与遗迹解谜。' }],
  ['game-2/guide/farming-guide.md', { copy: '查温室设施、量子无人机与天气机制。' }],
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

async function readEntry(knowledge, path) {
  const text = (await readFile(join(knowledge, path), 'utf8'))
    .replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const title = /^#\s+(.+)$/m.exec(text)?.[1].trim();
  if (!title) throw new Error('Missing H1 in ' + path);
  return {
    path, title, body: text.replace(/^#\s+.+$/m, '').trim(),
    edition: path.split('/')[0], category: categoryFor(path),
  };
}

async function entriesIn(knowledge, folder) {
  const result = [];
  for (const entry of await readdir(join(knowledge, folder), { withFileTypes: true })) {
    const path = posix.join(folder, entry.name);
    if (entry.isDirectory()) {
      result.push(...await entriesIn(knowledge, path));
    } else if (entry.isFile() && path.endsWith('.md')) {
      result.push(await readEntry(knowledge, path));
    }
  }
  return result;
}

const encodePath = path => path.split('/').map(encodeURIComponent).join('/');
const sourceLink = path => repository + '/blob/main/' + encodePath(path);
const rawSource = repository.replace('github.com', 'raw.githubusercontent.com') + '/main/';
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
      if (child.type === 'image') {
        child.attrSet('loading', 'lazy');
        child.attrSet('decoding', 'async');
        const src = child.attrGet('src');
        if (src && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)) {
          child.attrSet('src', new URL(src, rawSource + encodePath(entry.path)).href);
        }
        continue;
      }
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


export async function loadCatalog(knowledge) {
  const entries = (await Promise.all(Object.keys(editions).map(folder => entriesIn(knowledge, folder)))).flat();
  entries.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN') || a.path.localeCompare(b.path));
  return entries.map(({ title, path, edition, category }) => ({
    title, url: linkFor(path), edition, category,
    editionName: editions[edition], categoryName: categories[category],
    inHandbook: featured.has(path),
  }));
}

export async function loadArticles(knowledge) {
  return Promise.all([...featured].map(async ([path, { copy, stop }]) => {
    const entry = await readEntry(knowledge, path);
    const prefix = '../'.repeat(localArticle(path).split('/').length - 1);
    return {
      slug: path.replace(/\.md$/, ''),
      title: entry.title,
      copy,
      edition: editions[entry.edition],
      category: categories[entry.category],
      source: sourceLink(path),
      sourceLabel: stop ? '全文' : '原文',
      ...articleContent(entry, prefix),
    };
  }));
}
