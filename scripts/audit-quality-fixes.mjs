// A review stamp records visual work; hashes only detect changes since that review.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_WORDS,COURSE_AUDIO} from '../app/course-content.js';
import {sentenceMeaning} from '../app/sentence-meanings.js';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path,root)).then(JSON.parse);
const fixes=await json('data/vocabulary/quality-fixes.json'),baseline=await json('data/vocabulary/quality-review-2026-11-02.json');
const original=new Map(baseline.cards.map(c=>[c.id,c])),current=new Map(CATALOG_WORDS.map(w=>[w.id,w]));
const credits=new Map((await json('assets/credits.json')).map(c=>[c.file,c]));
const audio=new Map((await json('assets/audio/course-sources.json')).clips.map(c=>[c.key,c]));
const expectedAudio=new Map(COURSE_AUDIO.map(c=>[c.key,c]));
const offline=await json('dist/precache.json'),offlineFiles=new Set(offline.packs.find(p=>p.id==='all').files);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ids=new Set(),scope={},rows=[],changedSentences=[];
async function checkOffline(path,bytes){
 if(!offlineFiles.has(path)||offline.resources[path]?.sha256!==sha(bytes))throw Error(`Stale offline resource: ${path}`);
}
async function checkImage(id,reviewedHash){
 const word=current.get(id);if(!word)throw Error(`Missing quality card: ${id}`);
 const bytes=await readFile(new URL(word.image,root)),credit=credits.get(word.image.replace('./assets/',''));
 if(sha(bytes)!==reviewedHash||credit?.sha256!==reviewedHash)throw Error(`Re-review changed picture: ${id}`);
 for(const part of credit.components||[]){
  const component=await readFile(new URL(`assets/${part.file}`,root));
  if(sha(component)!==part.sha256||credits.get(part.file)?.license!==part.license)throw Error(`Stale component: ${id}/${part.file}`);
 }
 await checkOffline(word.image,bytes);return word;
}
for(const fix of fixes.entries){
 const before=original.get(fix.id);
 if(ids.has(fix.id)||!before?.findings.length||fix.priority!==before.reviewStatus||fix.status!=='reviewed'||!fix.visualReviewedOn)throw Error(`Incomplete quality repair: ${fix.id}`);
 ids.add(fix.id);scope[fix.priority]=(scope[fix.priority]||0)+1;
 const word=await checkImage(fix.id,fix.afterImageSha256);
 const old=await readFile(new URL(fix.originalImage,root));
 if(sha(old)!==before.sha256||fix.beforeImageSha256!==before.sha256||fix.afterImageSha256===before.sha256)throw Error(`Invalid before/after evidence: ${fix.id}`);
 if(word.pictureCue!==before.pictureCue)throw Error(`Changed quiz semantics without review: ${fix.id}`);
 const now={id:word.id,zh:word.zh,pos:word.pos||'',sentence:word.sentence,sentenceZh:word.sentenceZh??sentenceMeaning(word.sentence)};
 for(const [key,value] of Object.entries(fix.reviewedCard))if(now[key]!==value)throw Error(`Re-review changed text: ${fix.id}/${key}`);
 for(const key of [word.audio,`sentence-${word.id}`]){
  const expected=expectedAudio.get(key),actual=audio.get(key);
  if(!expected||actual?.text!==expected.text)throw Error(`Stale audio text: ${key}`);
  const path=`./assets/audio/${key}.wav`,bytes=await readFile(new URL(path,root));
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(34)!==16)throw Error(`Invalid PCM audio: ${key}`);
  let peak=0;for(let n=44;n+1<bytes.length;n+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(n)));
  if(peak<10)throw Error(`Silent audio: ${key}`);
  await checkOffline(path,bytes);
 }
 if(before.sentence!==now.sentence)changedSentences.push(word.id);
 rows.push({id:word.id,display:word.display||word.id,priority:fix.priority,status:'reviewed',note:fix.note,before:{zh:before.zh,sentence:before.sentence,sentenceZh:before.sentenceZh,image:fix.originalImage},after:{...now,image:word.image},imageSha256:fix.afterImageSha256});
}
for(const card of baseline.cards.filter(c=>c.findings.length))if(!ids.has(card.id))throw Error(`Unresolved original issue: ${card.id}`);
for(const [priority,count] of Object.entries(fixes.scope))if(scope[priority]!==count)throw Error(`Wrong repair scope: ${priority}`);
const collateral=new Map(fixes.collateralReviews.map(c=>[c.id,c]));
for(const card of CATALOG_WORDS.filter(c=>!ids.has(c.id))){
 const bytes=await readFile(new URL(card.image,root)),hash=sha(bytes);
 if(hash===original.get(card.id)?.sha256)continue;
 const review=collateral.get(card.id);
 if(review?.status!=='reviewed'||!review.visualReviewedOn)throw Error(`Unreviewed dependent image: ${card.id}`);
 await checkImage(card.id,review.afterImageSha256);
}
const report={scope,completed:ids.size,remaining:0,dependentImages:collateral.size,textChangedCards:rows.filter(r=>['zh','sentence','sentenceZh'].some(k=>r.before[k]!==r.after[k])).length,changedSentences,offlineVersion:offline.version,visualReview:fixes.validation,rows};
await writeFile(new URL('data/vocabulary/quality-fixes-report.json',root),JSON.stringify(report,null,2)+'\n');

const labels={priority_fix:'优先修改',improvement:'建议优化',sense_choice:'义项统一'};
const regression=fixes.validation.regression;
const regressionNote=regression?.finalBuild===offline.version?`规则测试 ${regression.nodePassed} 项通过；Chrome／WebKit 共 ${regression.browserUniquePassed} 个不同回归场景通过，各 ${regression.systemChromePassed}／${regression.webkitPassed} 项。最终构建在 SVG 行尾空白规范化后，另有 ${regression.finalAssetRecheckPassed} 项图片解码、断网重载与新句音哈希检查通过。首次默认 Chromium 未安装，已使用本机 Google Chrome 重跑成功；没有通过放宽断言规避问题。`:'本构建尚未记录对应的浏览器回归证据。';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const md=`# 词卡图文修订结果

本轮原清单的 306 张词卡已修订并完成模型图文复核：78 个优先问题、225 个优化项、3 个义项统一，剩余 0。另复查 ${collateral.size} 张因组件变化而重新生成的关联词卡，并修正其中 10 条配方，避免购物清单、比赛比分等组件被误用于其他语境。

[打开逐词修改前后对照](vocabulary-quality-fixes.html) · [原始检查报告](vocabulary-quality-review.md)

三个义项分别统一为 bunch（一串葡萄）、belt（腰带）、system（以太阳和行星组成的系统为实例）。${report.textChangedCards} 张调整了释义或中文例句，或同步改写英文例句；其中 ${changedSentences.length} 条英文例句已重新生成音频：${changedSentences.join('、')}。

306 张修订图先在 26 张总览中逐一查看；其中二次调整的 73 张又单独复查，并再次核对最后的细节图。${collateral.size} 张关联图也逐张查看，10 条改配方的图再次单独复查。全部图文内容、版权/组件哈希、非静音 PCM16 音频和当前离线资源哈希经脚本核对，版本 ${offline.version}。自动检查不等于教师认证或真实 iPad 硬件验收。

${regressionNote}

## 维护约定

- 图片修订定义在 scripts/pictures/quality-objects.mjs、quality-body.mjs、quality-places.mjs、quality-actions.mjs、quality-context.mjs、quality-language.mjs；共用绘图部件在 quality-primitives.mjs。改绘图源后运行 npm run pictures:quality，不能只替换生成的 SVG。
- data/vocabulary/quality-fixes.json 保存本次已复核的文字与图片哈希；语义内容变化时必须重新复核，不应仅更新哈希。原始图片保留在 data/vocabulary/quality-review-originals，未加入应用资源和离线包。
- context-completion-plan.json 中的 qualityRecipe 明确保留已修图，不被旧配方覆盖；同图的 tidy/chore/chores 使用同一分组，并继续遵守情境卡不出识图题、不自动算掌握的规则。
- 改英文例句后同步中文并生成句音，再构建、运行 npm run audit:completion 和 npm run audit:quality。本次未提交、未发布，也未修改 Git 暂存区。

地图轮廓使用 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) 的公有领域数据，来源和文件哈希在 data/reference-maps/quality-geography.json；其他图为项目原创矢量图或已保留许可的本地 Noto 组件。

## 逐词完成清单

| 原分类 | 单词 | 完成内容 |
|---|---|---|
${rows.map(r=>`| ${labels[r.priority]} | ${r.id} | ${r.note.replaceAll('|','\\|')} |`).join('\n')}
`;
await writeFile(new URL('docs/vocabulary-quality-fixes.md',root),md);
const payload=JSON.stringify(rows).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>词卡修订前后对照</title><style>*{box-sizing:border-box}body{font:16px/1.5 system-ui,-apple-system,'PingFang SC',sans-serif;background:#f1f4f4;margin:0;color:#20333c}header,main{max-width:1400px;padding:20px;margin:auto}h1{font-size:26px}h2{margin:6px 0;font-size:22px}h3{font-size:15px;color:#56666c;margin:5px 0}.controls{display:flex;gap:12px;flex-wrap:wrap;position:sticky;top:0;background:#f1f4f4;padding:12px 0}input,select,button{font:inherit;padding:9px;border-radius:7px;border:1px solid #afbdc1;background:white}input{flex:1;min-width:220px}#cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,550px),1fr));gap:18px}article{background:white;padding:16px;border-radius:12px;border:1px solid #d5dfe0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.after{background:#eff7ef;border-radius:8px;padding:9px}.before{padding:9px}img{width:100%;height:190px;object-fit:contain}p{margin:7px 0;overflow-wrap:anywhere}.zh{color:#176145}.badge{font-size:13px;color:#176145}.note{border-top:1px solid #dce5e3;padding-top:10px}.intro{max-width:1100px;color:#52666e}#more{display:block;margin:25px auto}#more[hidden]{display:none}a{color:#266087}@media(max-width:500px){header,main{padding:12px}article{padding:10px}.pair{gap:7px}img{height:145px}.before,.after{padding:5px}}</style>
<header><h1>306 张词卡 · 修订前后对照</h1><p class="intro">78 个优先问题、225 个优化项、3 个义项统一，均已修订并完成本轮模型图文复核；另复查 ${collateral.size} 张关联图。图片右侧是当前工作区内容。不是教师认证或真实 iPad 验收；本轮尚未发布。</p><p><a href="vocabulary-quality-fixes.md">修订报告</a></p></header><main><div class="controls"><input id="search" type="search" aria-label="搜索词卡" placeholder="搜索单词、释义或修改说明"><select id="priority" aria-label="筛选原分类"><option value="all">全部 306 张</option><option value="priority_fix">优先修改 · 78</option><option value="improvement">建议优化 · 225</option><option value="sense_choice">义项统一 · 3</option></select></div><p id="count" aria-live="polite"></p><div id="cards"></div><button id="more">再显示 24 张</button></main><script type="application/json" id="data">${payload}</script><script>
const rows=JSON.parse(document.querySelector('#data').textContent),labels=${JSON.stringify(labels)},rank={priority_fix:0,sense_choice:1,improvement:2};const search=document.querySelector('#search'),priority=document.querySelector('#priority'),cards=document.querySelector('#cards'),more=document.querySelector('#more');let limit=24;
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function side(c,name){return '<section class="'+name+'"><h3>'+(name==='before'?'修改前':'修改后')+'</h3><img loading="lazy" alt="'+(name==='before'?'修改前':'修改后')+'配图" src="../'+esc(c.image.replace(/^\\.\\//,''))+'"><p>'+esc(c.zh)+'</p><p lang="en">'+esc(c.sentence)+'</p><p class="zh">'+esc(c.sentenceZh)+'</p></section>';}
function render(){const q=search.value.trim().toLowerCase(),found=rows.filter(r=>(priority.value==='all'||priority.value===r.priority)&&[r.id,r.after.zh,r.after.sentence,r.after.sentenceZh,r.note].join(' ').toLowerCase().includes(q)).sort((a,b)=>rank[a.priority]-rank[b.priority]||a.id.localeCompare(b.id));document.querySelector('#count').textContent='匹配 '+found.length+' 张，显示 '+Math.min(limit,found.length)+' 张';cards.innerHTML=found.slice(0,limit).map(r=>'<article data-id="'+esc(r.id)+'"><span class="badge">已修订复核 · '+labels[r.priority]+'</span><h2>'+esc(r.display)+'</h2><div class="pair">'+side(r.before,'before')+side(r.after,'after')+'</div><p class="note">'+esc(r.note)+'</p></article>').join('');if(!found.length)cards.textContent='没有匹配的词卡。';more.hidden=limit>=found.length;}
for(const el of [search,priority])el.addEventListener(el===search?'input':'change',()=>{limit=24;render();});more.addEventListener('click',()=>{limit+=24;render();});render();</script></html>`;
await writeFile(new URL('docs/vocabulary-quality-fixes.html',root),html);
console.log(JSON.stringify({...report,rows:rows.length}));
