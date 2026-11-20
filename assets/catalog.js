const filters = document.querySelector('#filters');
const query = document.querySelector('#query');
const edition = document.querySelector('#edition');
const category = document.querySelector('#category');
const list = document.querySelector('#result-list');
const status = document.querySelector('#result-count');
const more = document.querySelector('#more');
const pageSize = 12;

const normalize = value => value.normalize('NFKC').toLowerCase();
let catalog = [];
let matches = [];

function appendResults() {
  const start = list.children.length;
  const fragment = document.createDocumentFragment();
  for (const entry of matches.slice(start, start + pageSize)) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const label = document.createElement('span');
    const meta = document.createElement('span');
    link.href = entry.url;
    label.className = 'result-title';
    label.textContent = entry.title;
    meta.className = 'result-meta';
    meta.textContent = [entry.editionName, entry.categoryName, entry.inHandbook ? '站内阅读' : 'GitHub 原文'].join(' · ');
    link.append(label, meta);
    item.append(link);
    fragment.append(item);
  }
  list.append(fragment);
  more.hidden = list.children.length >= matches.length;
  status.textContent = matches.length
    ? '共 ' + matches.length + ' 条，已显示 ' + list.children.length + ' 条'
    : '未找到匹配条目。可以试试其他名称或筛选条件。';
  if (start > 0) list.children[start]?.firstElementChild.focus();
}

function applyFilters() {
  const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
  matches = catalog.filter(entry =>
    (!edition.value || entry.edition === edition.value) &&
    (!category.value || entry.category === category.value) &&
    terms.every(term => entry.search.includes(term)),
  );
  list.replaceChildren();
  appendResults();
}

try {
  const response = await fetch(new URL('./catalog.json', import.meta.url));
  if (!response.ok) throw new Error('Catalog HTTP ' + response.status);
  catalog = (await response.json()).map(entry => ({
    ...entry, search: normalize(entry.title + ' ' + entry.editionName + ' ' + entry.categoryName),
  }));
  filters.hidden = false;
  filters.addEventListener('submit', event => event.preventDefault());
  query.addEventListener('input', applyFilters);
  edition.addEventListener('change', applyFilters);
  category.addEventListener('change', applyFilters);
  more.addEventListener('click', appendResults);
  applyFilters();
} catch {
  status.textContent = '资料目录暂时无法加载。请刷新页面，或打开上方的 GitHub 原始索引。';
}
