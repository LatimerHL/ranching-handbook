# 牧场笔记 · 中文手册

《史莱姆牧场》一代、二代的非官方中文资料手册。

- [手册网站](https://latimerhl.github.io/ranching-handbook/)
- [资料源仓库](https://github.com/LatimerHL/RanchingFieldNotes)

首页和站内攻略由 Astro 构建，共用 `BaseLayout` 的页面转场、字体和主题。`npm run build` 从资料源仓库的 `game-1/`、`game-2/` 与 `general/` 生成攻略页和资料索引。修改资料请到源仓库投稿。

通用动效在 `src/styles/motion.css` 中定义。`motion-rise` 用于内容淡入上移，`motion-feedback` 用于按钮和链接的按压反馈。

## 首页音频

首页的史莱姆被点击时会随机播放自己的叫声。音频放在 `assets/home-scene/voice/<史莱姆>/`，统一为 AAC-LC 封装在 MP4 里（`.m4a`）、单声道 44.1 kHz、48 kbps；多只史莱姆共用的片段只存一份，放在 `voice/shared/`，由各自的列表指向同一个文件。新增或替换音频时按同一配方转码：

```sh
ffmpeg -i clip.wav -ac 1 -ar 44100 -c:a aac -profile:a aac_low -b:a 48k -movflags +faststart -map_metadata -1 clip.m4a
```

再把文件名加进 `src/data/slime-voice.ts` 中对应史莱姆的列表（路径相对 `assets/home-scene/voice/`）。音频在首页的加载阶段就开始拉取（整只首页约 218 KB，与画面一起算进加载遮罩），所以第一次点击就是即时的；开启"节省流量"的浏览器会跳过预取，等到点击时再取那一小段。

## 本地预览

```sh
git clone --depth 1 https://github.com/LatimerHL/RanchingFieldNotes.git knowledge
npm ci
npm run build
python -m http.server 8000 --directory dist
```

打开 `http://localhost:8000/`。也可以运行 `npm run build -- ../RanchingFieldNotes` 来使用已有的知识库副本。

## 字体与语言

默认语种为 `zh-Hans`，中文使用 Noto Sans SC，拉丁字符使用 Mona Sans。繁中 Astro 页面可向 `BaseLayout` 传入 `locale="zh-Hant"`，字体会切换为 Noto Sans TC。页面文案与知识库条目由对应语种的内容提供。

字体及其 SIL Open Font License 1.1 文件随构建输出放在 `dist/assets/fonts/`，网页从自身站点加载字体。

## 发布

网站仓库的 `main` 更新时，GitHub Actions 读取源仓库当时的 `main`，构建并部署到 GitHub Pages。仅更新了源仓库时，在本仓库的 [Actions](https://github.com/LatimerHL/ranching-handbook/actions/workflows/pages.yml) 中手动运行 **Deploy handbook** 即可发布新资料。

首页使用《史莱姆牧场 2》主题封面。站点为非商业粉丝内容，游戏权利归 Monomi Park, LLC 所有。[粉丝内容政策](https://www.slimerancher.com/fan-content-policy/)
