# 26 个字母音频核验

当前状态：名称和字母音已使用用户提供的 GK 录音，共 52 段。以下早期资源调查为历史记录，最新接入见文末 GK 章节。

核验日期：2026-10-30。范围：26 个名称、26 个基础字母音、26 个示例词，共 78 段。

## 已确认与阻塞

- 78 段文件均可解码；时长、格式、来源和 SHA-256 见 audio-audit.json。此结果不证明发音正确。
- 名称 B/C/D/F/G/M/S/T/U 共 9 段来自 Twocs；字母音 G 来自 Peter Isotalo；其余 68 段为 af_heart 合成音。未实现整套统一真人声音。
- 所有 78 段发音审听状态均为 pending，不将未审听视为通过，也不将未审听一概视为错误。
- 现有音频分析服务对 b 给出的内容与文件不符，结果已排除；目前缺少可靠的逐条听觉核验手段。
- 本次新增替换 C/D/F/M/S/T/U 共 7 个名称，本地已有 9 个 Twocs 名称；未发布、未修改暂存区。

## 候选来源

- [GCompris 名称录音署名](https://github.com/KDE/gcompris-data/blob/master/voices/en_GB/alphabet/README)：26 个名称均署名 Julia Wycherley，GPL。英音方案，不能直接覆盖目前的美音音标而不同时校准课程。
- [GCompris 单词来源](https://github.com/KDE/gcompris-data/blob/master/voices/en_GB/words/README)：来自 Art4Apps，CC BY-SA 3.0；不能据此证明与名称为同一说话人。
- [learn-letters](https://github.com/minormending/learn-letters)：提供 UK 音素，但仅声明 public-use，缺少原始录音者和明确的上游授权依据；暂不导入。
- [Oxford Owl](https://home.oxfordowl.co.uk/phonics-videos/)：发音对照用，尚未取得随本网站分发的授权。

## 统一录音与验收要求

同一位熟悉自然拼读的说话人按下表录制三份独立素材，统一一种英语口音；当前目标表沿用网站美音设置。名称读名称、字母音读目标音、例词读完整单词，不把三项录到同一个文件中。保持自然音量，不拉伸音高，不通过剪完整单词冒充经审听的孤立音。

b/d/g/p/t/k 等辅音重点检查是否混入额外的 uh 元音；Q 项是 qu 的 /kw/，X 项是 box 中的 /ks/。R 当前代码以 /r/ 简写英语 r，录音应为英语近音，不应采用颤音。

由熟悉该口音及自然拼读的审听者逐条记录：实际读音、是否多音/少音、额外元音、口音一致性和通过/重录结论；同时核对素材许可。通过后按固定文件名导入，更新来源、哈希和审听记录，再验证播放与离线缓存。

## 逐字母清单

以下为录音目标，不代表已听到的实际发音。每行三段均待审听。

| 字母 | 名称目标 | 基础音目标 | 示例词 | 发音验收 |
|---|---|---|---|---|
| A | /eɪ/ | /æ/ | apple | 待审听（3 段） |
| B | /biː/ | /b/ | ball | 待审听（3 段） |
| C | /siː/ | /k/ | cat | 待审听（3 段） |
| D | /diː/ | /d/ | dog | 待审听（3 段） |
| E | /iː/ | /ɛ/ | egg | 待审听（3 段） |
| F | /ɛf/ | /f/ | fish | 待审听（3 段） |
| G | /dʒiː/ | /ɡ/ | goat | 待审听（3 段） |
| H | /eɪtʃ/ | /h/ | hat | 待审听（3 段） |
| I | /aɪ/ | /ɪ/ | insect | 待审听（3 段） |
| J | /dʒeɪ/ | /dʒ/ | jam | 待审听（3 段） |
| K | /keɪ/ | /k/ | kite | 待审听（3 段） |
| L | /ɛl/ | /l/ | leaf | 待审听（3 段） |
| M | /ɛm/ | /m/ | moon | 待审听（3 段） |
| N | /ɛn/ | /n/ | nest | 待审听（3 段） |
| O | /oʊ/ | /ɑ/ | ox | 待审听（3 段） |
| P | /piː/ | /p/ | pig | 待审听（3 段） |
| Q | /kjuː/ | /kw/ | queen | 待审听（3 段） |
| R | /ɑɹ/ | /r/ | rabbit | 待审听（3 段） |
| S | /ɛs/ | /s/ | sun | 待审听（3 段） |
| T | /tiː/ | /t/ | top | 待审听（3 段） |
| U | /juː/ | /ʌ/ | up | 待审听（3 段） |
| V | /viː/ | /v/ | van | 待审听（3 段） |
| W | /dʌbəljuː/ | /w/ | web | 待审听（3 段） |
| X | /ɛks/ | /ks/ | box | 待审听（3 段） |
| Y | /waɪ/ | /j/ | yes | 待审听（3 段） |
| Z | /ziː/ | /z/ | zebra | 待审听（3 段） |

## Twocs 来源排查与接入

Commons 上传清单查到 17 个名称：B C D F G H L M O Q S T U V W X Y，无更多分页。未发现该上传者的纯字母音或本站示例词。已接入 B C D F G M S T U；H L O Q V W X Y 因下载连接错误/限流尚未接入。A E I J K N P R Z 未找到此人的录音。候选来源及原始 SHA-1 保存在 assets/audio/twocs-names.json；每个实际接入项保存在 sources.json 的 recordingOverrides 和 credits.json 中。

本轮验证：构建通过（版本 93db2459e198）；Chromium（本机 Chrome）和 WebKit（本机已安装引擎）各验证 9 个大小写共用名称按钮离线播放，共 18 次；每段离线音频的 SHA-256 与导入文件一致。未做真实 iPad 验收，未完成专业听觉审听。git diff --check 通过，暂存区未改动。

## GCompris 完整候选（2026-10-30）

26 个名称已保存到 assets/audio/gcompris/，录音者 Julia Wycherley，2011 年，来源为 KDE/gcompris-data 的 voices/en_GB/alphabet。逐文件 Git blob SHA-1 与上游目录元数据一致；原始 OGG、上游署名清单和 GPL v3 文本均随包保留，WAV 只转码为 24 kHz 单声道 PCM16。上游署名仅写 GPL，未声称其明确标注 GPL v3；本候选包按 GPL v3 提供。

试听入口：/assets/audio/gcompris/index.html。支持 A–Z 单独播放、顺序连播、停止、大小写配对展示与 Starfall 外链参考。当前课程仍使用原有名称/音素/示例词；试听不修改学习记录或录音配置。名称候选不能代表完整自然拼读课程，实际发音审听仍待完成；若采用英音，需同步核对名称音标和相关示范。

重新导入命令：node scripts/import-gcompris-audio.mjs。构建会校验 26 项完整性、原始文件哈希、PCM16 格式和署名/许可文件是否齐全。

验收：Chromium 与 WebKit 两项浏览器场景通过，覆盖每个字母实际离线播放（合计 52 段）、A 到 B 连播、停止后的音频/选中状态，以及 390px 手机宽度无横向溢出。检查了手机页截图，并缩短卡片提示避免窄屏断词。非真实 iPad 硬件验收，也不作为专业审听证明。

## 当前使用：用户提供的 GK 录音

来源：用户提供的《GK 26个字母拼读音.mp3》，SHA-256 为 74f993ee6c9b72c574842bb05b8d7356940afdfdf20d0c5b4452d9b5f56e5d06。原始文件约 77.61 秒；解码时出现三处坏帧提示，归一到 24 kHz 单声道后为 77.4 秒。切点全部基于这条解码后的时间线，不能直接套到其他版本录音。

音频分析识别为 A–Z，各名称三遍、字母音三遍；普通 Whisper 转写在孤立音上失败，未采用其转写结果。结合停顿和逐字母波形检查，切成 26 段名称、26 段字母音，保留原有重复。音量以 -6 dBFS 峰值为目标，上调最多 12 dB，避免把轻辅音的底噪无限放大；未变速、改音高、强降噪。未声称完成专业发音审听。切点、原始文件、逐段增益与哈希保存在 assets/audio/gk/。

现已在本地替换 name-A..Z / sound-A..Z。字母册、课堂示范和听音辨认按原有调用链使用这些文件；家长已有的 customAudio 仍优先，未清除学习记录。例词和合音仍是原有录音，不宣称整站同声。GCompris 保留为独立候选试听。公开再分发许可未注明，本轮未发布到线上。

首次替换前的旧 52 段音频及来源清单备份在 /var/folders/d3/cv0mrt0j5bl6d70p2lmfhh3w0000gn/T/abc-before-gk-wd3uKI。

验证：11 项规则测试通过；最终构建版本 248137c29405；Chromium 与 WebKit 各验证 52 段离线播放、文件 SHA-256、切片时长与离页停止，共 104 次逐项播放检查。52 段均为 24 kHz 单声道 PCM16，最高采样峰值 0.5012，无削波。原始 MP3 的 HTTP Range 和 audio/mpeg 响应正常。暂存区未修改。未在真实 iPad 上验收。
