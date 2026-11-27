# 鐗у満绗旇 路 涓枃鎵嬪唽

銆婂彶鑾卞鐗у満銆嬩竴浠ｃ€佷簩浠ｇ殑闈炲畼鏂逛腑鏂囪祫鏂欐墜鍐屻€?

- [鎵嬪唽缃戠珯](https://latimerhl.github.io/ranching-handbook/)
- [璧勬枡婧愪粨搴揮(https://github.com/LatimerHL/RanchingFieldNotes)

棣栭〉鍜岀珯鍐呮敾鐣ョ敱 Astro 鏋勫缓锛屽叡鐢?`BaseLayout` 鐨勯〉闈㈣浆鍦恒€佸瓧浣撳拰涓婚銆俙npm run build` 浠庤祫鏂欐簮浠撳簱鐨?`game-1/`銆乣game-2/` 涓?`general/` 鐢熸垚鏀荤暐椤靛拰璧勬枡绱㈠紩銆備慨鏀硅祫鏂欒鍒版簮浠撳簱鎶曠銆?

閫氱敤鍔ㄦ晥鍦?`src/styles/motion.css` 涓畾涔夈€俙motion-rise` 鐢ㄤ簬鍐呭娣″叆涓婄Щ锛宍motion-feedback` 鐢ㄤ簬鎸夐挳鍜岄摼鎺ョ殑鎸夊帇鍙嶉銆?

## 濯掍綋鏍煎紡

鍏ㄧ珯濯掍綋鎸変笁绫荤粺涓€鏍煎紡锛?*鍥惧儚 WebP**銆?*闊抽 M4A**銆?*瑙嗛鏆傛棤**銆傚疄鍦ㄧ粺涓€涓嶄簡鐨勮祫婧愬崟鐙垪鍑猴紙鐩墠鍙湁榧犳爣鎸囬拡锛夈€傛柊澧炴垨鏇挎崲绱犳潗鎸夋湰鑺傚鐞嗭紝鏍煎紡涓嶄竴鑷寸殑鏂囦欢涓嶈鐩存帴鏀捐繘 `assets/`銆?

### 鍥惧儚

缁熶竴 WebP锛氭湁鎹?VP8銆乹uality 95銆乵ethod 6锛屼繚鐣?alpha銆傚満鏅眰銆佺偣鍑婚浂浠躲€佺珯鐐瑰浘鏍囧叡鐢ㄨ繖涓€浠介厤鏂癸紝浠?PNG 杞嚭鍚庡垹鎺夋簮鏂囦欢锛?

```python
im = Image.open(src)
im = im.convert("RGBA") if has_alpha else im.convert("RGB")
im.save(dst, "WEBP", quality=95, method=6)
```

- 閫?q95 鏈夋崯鑰屼笉鏄棤鎹?PNG锛氭棤鎹?WebP 閫氬父鏄袱涓夊€嶄綋绉紝鑰?1:1 涓嬬湅涓嶅嚭宸埆銆?
- 鍙浆鐮侊紝涓嶇缉鏀俱€佷笉瑁佸壀銆佷笉閿愬寲锛涢€忔槑杈圭紭涓嶉摵 matte銆?
- 鍦烘櫙鍧愭爣鍐欏湪 `src/data/home-scene.json`锛堟í灞忥級鍜?`home-scene-portrait.json`锛堢珫灞忥級锛涢浂浠跺悕瑕佷笌 `src/data/slime-parts.ts` 鐨勭櫥璁颁竴鑷达紝`HomeKeyArt.astro` 鎸?`parts/${item}/${layer}.webp` 鎷艰矾寰勩€?
- 鍛藉悕鍏ㄥ皬鍐欍€佽繛瀛楃鍒嗚瘝锛涙浛鎹㈢礌鏉愪繚鎸佸悓鍚嶏紝閬垮厤鏀瑰紩鐢ㄣ€?
- 涓嶅仛 AVIF/JXL 澶氭牸寮忓垎鏀細WebP 宸茶鐩栧叏閮ㄧ洰鏍囨祻瑙堝櫒锛涘皢鏉ヨ涓?AVIF 灏辩敤 `<picture>` 浠?WebP 鍏滃簳銆?
- `assets/` 鐩墠杩樼暀鐫€涓ゅ紶鏃犲紩鐢ㄧ殑 keyart PNG锛堢害 3.3 MB锛夊拰 `ranch.webp`锛?19 KB锛夛紱[build.mjs](build.mjs) 浼氭暣鐩綍鎷疯繘 `dist/`锛屾斁杩?`assets/` 灏辩瓑浜庤繘閮ㄧ讲浜х墿锛屽埆鏀捐崏绋裤€?

#### 榧犳爣鎸囬拡

CSS `cursor:` 瀵?WebP 鐨勬敮鎸佸湪閮ㄥ垎娴忚鍣ㄤ笂涓嶇ǔ瀹氾紝鎵€浠ユ寚閽堜繚鎸?PNG锛歚assets/cursors/` 涓?32/64 涓ゆ。銆佹槑鏆楀悇涓€濂楋紝鍚堣绾?9 KB銆?

### 闊抽

棣栭〉鐨勫彶鑾卞琚偣鍑绘椂浼氶殢鏈烘挱鏀捐嚜宸辩殑鍙０銆傞煶棰戞斁鍦?`assets/home-scene/voice/<鍙茶幈濮?/`锛岀粺涓€涓?AAC-LC 灏佽鍦?MP4 閲岋紙`.m4a`锛夈€佸崟澹伴亾 44.1 kHz銆?8 kbps锛涘鍙彶鑾卞鍏辩敤鐨勭墖娈靛彧瀛樹竴浠斤紝鏀惧湪 `voice/shared/`锛岀敱鍚勮嚜鐨勫垪琛ㄦ寚鍚戝悓涓€涓枃浠躲€傛父鎴忓師澹伴灏惧甫鐫€鏁板瓧闈欓煶锛堟暣娈甸噰鏍蜂负 0锛夛紝鏋勫缓鏃跺彧鍒囨帀杩欎竴娈碉細闃堝€?鈭?00 dB 浣庝簬涓€涓?16-bit LSB锛屾墍浠ヤ换浣曢潪闆堕噰鏍烽兘绠楁湁澹帮紝娣峰搷灏惧反涓嶄細琚垏鎺夛紝鍚劅涓庢簮鏂囦欢涓€鑷淬€傛柊澧炴垨鏇挎崲闊抽鏃舵寜鍚屼竴閰嶆柟杞爜锛?

```sh
ffmpeg -i clip.wav -ac 1 -ar 44100 \
  -af "silenceremove=start_periods=1:start_threshold=-100dB:start_silence=0.01:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-100dB:start_silence=0.01:detection=peak,areverse" \
  -c:a aac -profile:a aac_low -b:a 48k -movflags +faststart -map_metadata -1 clip.m4a
```

鍐嶆妸鏂囦欢鍚嶅姞杩?`src/data/slime-voice.ts` 涓搴斿彶鑾卞鐨勫垪琛紙璺緞鐩稿 `assets/home-scene/voice/`锛夈€傚彶鑾卞鐨勫０闊虫寜绱犳潗鏂囦欢鍚嶈棰嗭細`xxx-slime.webp` 鍘绘帀鍚庣紑灏辨槸瀹冪殑搴撳悕锛岄浮鏄?`sea-hen`锛沗foreground/plorts/` 涓嬬殑鏅朵綋涓嶇畻鐢熺墿锛屼笉浼氬彂鍑哄０闊炽€傞煶棰戝湪棣栭〉鐨勫姞杞介樁娈靛氨寮€濮嬫媺鍙栵紝骞朵笖**鍔犺浇閬僵浼氱瓑鍏ㄩ儴鐗囨鍒版墜鎵嶆挙**锛堟暣鍙椤电害 243 KB锛屼笌鐢婚潰涓€璧风畻杩涘姞杞芥椂闂达級锛屾墍浠ョ涓€娆＄偣鍑诲氨鏄嵆鏃剁殑锛涘紑鍚?鑺傜渷娴侀噺"鐨勬祻瑙堝櫒浼氳烦杩囬鍙栵紝绛夊埌鐐瑰嚮鏃跺啀鍙栭偅涓€灏忔銆?

姣忓彧鍙茶幈濮嗕竴涓挱鏀惧櫒锛氱偣鍙︿竴鍙笉浼氭墦鏂繖涓€鍙紝鍑犲０鍙彲浠ュ彔鍦ㄤ竴璧凤紱鍚屼竴鍙病璇村畬鏃跺啀鐐瑰畠涓嶄細浠庡ご閲嶆潵锛岃瀹屼箣鍚庡啀鐐规墠鎹笅涓€娈点€?

### 瑙嗛

绔欏唴鏆傛棤瑙嗛銆傚皢鏉ョ粺涓€ WebM/AV1锛屽苟鍦?`<video>` 閲岀粰 MP4锛圚.264锛夊厹搴曘€?

## 鏈湴棰勮

```sh
git clone --depth 1 https://github.com/LatimerHL/RanchingFieldNotes.git knowledge
npm ci
npm run build
python -m http.server 8000 --directory dist
```

鎵撳紑 `http://localhost:8000/`銆備篃鍙互杩愯 `npm run build -- ../RanchingFieldNotes` 鏉ヤ娇鐢ㄥ凡鏈夌殑鐭ヨ瘑搴撳壇鏈€?

## 瀛椾綋涓庤瑷€

榛樿璇涓?`zh-Hans`锛屼腑鏂囦娇鐢?Noto Sans SC锛屾媺涓佸瓧绗︿娇鐢?Mona Sans銆傜箒涓?Astro 椤甸潰鍙悜 `BaseLayout` 浼犲叆 `locale="zh-Hant"`锛屽瓧浣撲細鍒囨崲涓?Noto Sans TC銆傞〉闈㈡枃妗堜笌鐭ヨ瘑搴撴潯鐩敱瀵瑰簲璇鐨勫唴瀹规彁渚涖€?

瀛椾綋鍙婂叾 SIL Open Font License 1.1 鏂囦欢闅忔瀯寤鸿緭鍑烘斁鍦?`dist/assets/fonts/`锛岀綉椤典粠鑷韩绔欑偣鍔犺浇瀛椾綋銆?

## 鍙戝竷

缃戠珯浠撳簱鐨?`main` 鏇存柊鏃讹紝GitHub Actions 璇诲彇婧愪粨搴撳綋鏃剁殑 `main`锛屾瀯寤哄苟閮ㄧ讲鍒?GitHub Pages銆備粎鏇存柊浜嗘簮浠撳簱鏃讹紝鍦ㄦ湰浠撳簱鐨?[Actions](https://github.com/LatimerHL/ranching-handbook/actions/workflows/pages.yml) 涓墜鍔ㄨ繍琛?**Deploy handbook** 鍗冲彲鍙戝竷鏂拌祫鏂欍€?

棣栭〉浣跨敤銆婂彶鑾卞鐗у満 2銆嬩富棰樺皝闈€傜珯鐐逛负闈炲晢涓氱矇涓濆唴瀹癸紝娓告垙鏉冨埄褰?Monomi Park, LLC 鎵€鏈夈€俒绮変笣鍐呭鏀跨瓥](https://www.slimerancher.com/fan-content-policy/)
