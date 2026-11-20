# 牧场笔记 · 中文手册

《史莱姆牧场》一代、二代的非官方中文资料手册。

- [手册网站](https://latimerhl.github.io/ranching-handbook/)
- [资料源仓库](https://github.com/LatimerHL/RanchingFieldNotes)

本仓库维护网站。资料以源仓库的 Markdown 为准，网站构建时读取 `game-1/`、`game-2/` 与 `general/`。目录按游戏和主题筛选，精选攻略可以在站内阅读，其余条目链接到对应的 GitHub 原文。修改资料请到源仓库投稿。

## 本地预览

```sh
git clone --depth 1 https://github.com/LatimerHL/RanchingFieldNotes.git knowledge
npm ci
npm run build
python -m http.server 8000 --directory dist
```

打开 `http://localhost:8000/`。也可以运行 `npm run build -- ../RanchingFieldNotes` 来使用已有的知识库副本。

## 发布

网站仓库的 `main` 更新时，GitHub Actions 读取源仓库当时的 `main`，构建并部署到 GitHub Pages。仅更新了源仓库时，在本仓库的 [Actions](https://github.com/LatimerHL/ranching-handbook/actions/workflows/pages.yml) 中手动运行 **Deploy handbook** 即可发布新资料。

首页插画由 ImageGen 生成。站点为非商业粉丝内容，游戏权利归 Monomi Park, LLC 所有。[粉丝内容政策](https://www.slimerancher.com/fan-content-policy/)
