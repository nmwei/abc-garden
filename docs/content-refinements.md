# 词卡内容复核后的补充修订

本次处理 21 张词卡：14 张配图、9 张双语例句或翻译、12 段录音；范围有重叠。

- 发音：close 按“合上”的动词义使用 /z/；Ms. 使用 /mɪz/，同步修复句中称呼读音。recall、transfer 的单词重音与当前动词例句统一，其他可接受的重音变体不判为错误。
- 图片：jump 改为空中跳越地面线；fork、knife 改为各自独立餐具；noon、midnight 加入日夜区分；grape 对应一颗葡萄；coach 改为运动教练；lamp 突出灯；cover 标出书封面；close 表达合书过程；announce、charity、increase、research 对应新例句。
- 句子：diving、surfing 直接出现目标词；announce、polish 改用自然简短表达；research、charity、increase 改用植物研究、捐玩具、书本增加的情境；charm 中文改为“这间旧屋别有一番魅力”；Ms. 统一标点。英文改写均同步中文和录音，原文不再沿用不适用的引用署名。

## 维护入口

图片源在 `scripts/pictures/refinement-scenes.mjs`，通过 `npm run pictures:quality` 生成独立 SVG 和 `app/refined-pictures.js`。不要只修改生成文件。使用独立图片地址避免改变旧共用组件的其他词卡；词卡渲染、题目与离线包统一读取有效的 `word.image`，测试也按该地址核对版权哈希。

发音例外在 `data/vocabulary/context-pronunciations.json`。更新例句后运行编译脚本和 `node scripts/generate-picture-audio.mjs`；只会重新生成输入或音素改变的录音。修订快照在 `data/vocabulary/content-refinements.json`，语义改变后先复核再更新快照，不能只刷新哈希绕过检查。

## 验证

14 张新图已逐张查看；46 项 Node 测试通过。1195 张补全词卡、原 306 张质量修订及 84 张关联图的审计通过。补充审计覆盖 21 张词卡的双语快照、图片版权、词音和句音文本、非静音 PCM、离线哈希。

浏览器检查覆盖新图解码、当前页面图片路径、9 张代表词卡的例句和录音播放、断网重载及音频字节一致性。桌面 Chrome / WebKit 自动检查不代表真实 iPad 验收；波形和生成音素校验不等于教师逐条听读认证。

审计命令：`node scripts/audit-content-refinements.mjs`、`node scripts/audit-quality-fixes.mjs --check`。后者保留历史报告，不用本次构建覆盖旧报告中的验证记录。
