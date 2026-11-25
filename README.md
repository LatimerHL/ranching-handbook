# 牧场笔记 · 中文手册

《史莱姆牧场》一代、二代的非官方中文资料手册。

- [手册网站](https://latimerhl.github.io/ranching-handbook/)
- [资料源仓库](https://github.com/LatimerHL/RanchingFieldNotes)

首页和站内攻略由 Astro 构建，共用 `BaseLayout` 的页面转场、字体和主题。`npm run build` 从资料源仓库的 `game-1/`、`game-2/` 与 `general/` 生成攻略页和资料索引。修改资料请到源仓库投稿。

通用动效在 `src/styles/motion.css` 中定义。`motion-rise` 用于内容淡入上移，`motion-feedback` 用于按钮和链接的按压反馈。

## 媒体格式

全站媒体按三类统一格式：**图像 WebP**、**音频 M4A**、**视频暂无**。实在统一不了的资源单独列出（目前只有鼠标指针）。新增或替换素材按本节处理，格式不一致的文件不要直接放进 `assets/`。

### 图像

统一 WebP：有损 VP8、quality 95、method 6，保留 alpha。场景层、点击零件、站点图标共用这一份配方，从 PNG 转出后删掉源文件：

```python
im = Image.open(src)
im = im.convert("RGBA") if has_alpha else im.convert("RGB")
im.save(dst, "WEBP", quality=95, method=6)
```

- 选 q95 有损而不是无损/PNG：无损 WebP 通常是两三倍体积，而 1:1 下看不出差别。
- 只转码，不缩放、不裁剪、不锐化；透明边缘不铺 matte。
- 场景坐标写在 `src/data/home-scene.json`（横屏）和 `home-scene-portrait.json`（竖屏）；零件名要与 `src/data/slime-parts.ts` 的登记一致，`HomeKeyArt.astro` 按 `parts/${item}/${layer}.webp` 拼路径。
- 命名全小写、连字符分词；替换素材保持同名，避免改引用。
- 不做 AVIF/JXL 多格式分支：WebP 已覆盖全部目标浏览器；将来要上 AVIF 就用 `<picture>` 以 WebP 兜底。
- `assets/` 目前还留着两张无引用的 keyart PNG（约 3.3 MB）和 `ranch.webp`（319 KB）；[build.mjs](build.mjs) 会整目录拷进 `dist/`，放进 `assets/` 就等于进部署产物，别放草稿。

#### 鼠标指针

CSS `cursor:` 对 WebP 的支持在部分浏览器上不稳定，所以指针保持 PNG：`assets/cursors/` 下 32/64 两档、明暗各一套，合计约 9 KB。

### 音频

首页的史莱姆被点击时会随机播放自己的叫声。音频放在 `assets/home-scene/voice/<史莱姆>/`，统一为 AAC-LC 封装在 MP4 里（`.m4a`）、单声道 44.1 kHz、48 kbps；多只史莱姆共用的片段只存一份，放在 `voice/shared/`，由各自的列表指向同一个文件。游戏原声首尾带着数字静音（整段采样为 0），构建时只切掉这一段：阈值 −100 dB 低于一个 16-bit LSB，所以任何非零采样都算有声，混响尾巴不会被切掉，听感与源文件一致。新增或替换音频时按同一配方转码：

```sh
ffmpeg -i clip.wav -ac 1 -ar 44100 \
  -af "silenceremove=start_periods=1:start_threshold=-100dB:start_silence=0.01:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-100dB:start_silence=0.01:detection=peak,areverse" \
  -c:a aac -profile:a aac_low -b:a 48k -movflags +faststart -map_metadata -1 clip.m4a
```

再把文件名加进 `src/data/slime-voice.ts` 中对应史莱姆的列表（路径相对 `assets/home-scene/voice/`）。音频在首页的加载阶段就开始拉取，并且**加载遮罩会等全部片段到手才撤**（整只首页约 218 KB，与画面一起算进加载时间），所以第一次点击就是即时的；开启"节省流量"的浏览器会跳过预取，等到点击时再取那一小段。

每只史莱姆一个播放器：点另一只不会打断这一只，几声叫可以叠在一起；同一只没说完时再点它不会从头重来，说完之后再点才换下一段。

### 视频

站内暂无视频。将来统一 WebM/AV1，并在 `<video>` 里给 MP4（H.264）兜底。

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
