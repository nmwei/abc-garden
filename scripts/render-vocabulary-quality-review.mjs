// Render a dated review without changing application content or review decisions.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_WORDS,WORDS} from '../web/app/course-content.js';
import {sentenceMeaning} from '../web/app/sentence-meanings.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await readFile(new URL('data/vocabulary/quality-review-2026-11-02.json',root),'utf8'));
const labels={priority_fix:'优先修改',improvement:'建议优化',sense_choice:'义项待确定',no_obvious_issue:'本轮未见明显问题'};
const rank={priority_fix:0,sense_choice:1,improvement:2,no_obvious_issue:3};
const current=new Map(CATALOG_WORDS.map(w=>[w.id,w]));
const fields=['id','display','zh','pos','sentence','sentenceZh','pictureCue','image'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const stale=[],seen=new Set(),counts={};
for(const card of report.cards){
 if(seen.has(card.id)||!Object.hasOwn(labels,card.reviewStatus))throw Error(`Invalid review row: ${card.id}`);
 seen.add(card.id);counts[card.reviewStatus]=(counts[card.reviewStatus]||0)+1;
 for(const f of card.findings)if(f.id!==card.id||f.severity!==card.reviewStatus)throw Error(`Invalid finding: ${card.id}`);
 const word=current.get(card.id);
 if(!word){stale.push(`${card.id}: removed`);continue;}
 const actual={...word,display:word.display||word.id,pos:word.pos||'',sentenceZh:word.sentenceZh??sentenceMeaning(word.sentence)};
 const content=JSON.stringify(Object.fromEntries(fields.map(k=>[k,actual[k]??''])));
 if(sha(content)!==card.contentSha256)stale.push(`${card.id}: text or image mapping changed`);
 if(sha(await readFile(new URL('web/'+word.image,root)))!==card.sha256)stale.push(`${card.id}: image changed`);
}
for(const id of current.keys())if(!seen.has(id))stale.push(`${id}: not reviewed`);
for(const [key,n] of Object.entries(report.summary))if(counts[key]!==n)throw Error(`Incorrect summary: ${key}`);
if(stale.length)throw Error(`Review snapshot is stale; re-review changed cards before regenerating:\n${stale.join('\n')}`);
if(process.argv.includes('--check')){
 console.log(JSON.stringify({reviewed:seen.size,rawCards:WORDS.length,aliases:WORDS.length-seen.size,summary:counts,stale:0}));
 process.exit(0);
}

const flagged=report.cards.filter(c=>c.findings.length).sort((a,b)=>rank[a.reviewStatus]-rank[b.reviewStatus]||a.index-b.index);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cell=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const md=`# 全词库图文质量初审（${report.reviewedOn}）

当前展示的 ${seen.size.toLocaleString('en-US')} 张规范词卡已逐张查看图片、释义、英文例句和中文例句。原始来源有 ${WORDS.length} 条，${WORDS.length-seen.size} 条重复拼写/别名不重复计数。本轮是模型视觉与语言初审，未由教师逐条复核，也不保证没有遗漏。

[打开可筛选图文清单](vocabulary-quality-review.html) · [完整快照与逐词问题](../data/vocabulary/quality-review-2026-11-02.json)

| 结论 | 词卡数 | 含义 |
|---|---:|---|
| 优先修改 | ${counts.priority_fix} | 配错对象、图文相反、关键义项/翻译缺失，或具体词配图容易形成错误理解 |
| 建议优化 | ${counts.improvement} | 部位未标示、动作线索弱、图句场景不同或缩略图不清晰；不等于全部错误 |
| 义项待确定 | ${counts.sense_choice} | bunch、belt、system：先统一本卡教学用法，再改图片或文字 |
| 本轮未见明显问题 | ${counts.no_obvious_issue} | 本轮没有列出修改项，不等于教师认证或无错保证 |

优先修改项中，71 张涉及图片，7 张涉及文字；建议优化项中，223 张涉及图片、2 张涉及文字；3 张义项待定都涉及图文对齐。共 297 张有图片相关建议，10 张有文字相关建议，system 同时属于两类。不要把 306 张有建议的卡都称为错误卡。

## 重点问题

| 单词 | 当前问题 | 推荐处理 |
|---|---|---|
| prefer | 例句更喜欢猫，图却写 I prefer dogs 并指向狗 | 换成猫与狗对照，箭头指向猫，文字改为 I prefer cats. |
| seed / root / soil / mud | 共用幼苗，分别没有呈现种子、根系、土或泥 | 画准确对象，根系可用地下剖面 |
| armchair / stamp / mittens | 分别使用双人沙发、邮筒、五指手套 | 换单人扶手椅、邮票、连指手套 |
| omelet / grain / tire | 煎蛋代蛋饼，稻穗代一粒小麦，木辐车轮代橡胶轮胎 | 换准确物体，保留可识别特征 |
| dentist / driver / librarian | 牙齿、公交车、书籍代替职业人物 | 人物与工作场景同时出现 |
| skirt / fence | 粉红裙子配蓝裙子例句，木栅栏配铁栅栏例句 | 优先修改图片，以保留已有句音 |
| ask / turn | 提问配请求帮助，转动配翻页，释义未覆盖本例 | 补明本例的请求、翻页义 |
| characteristic / ecology | 中文例句漏掉一贯/特有含义，或把生态学译为生态环境 | 修正中文例句，保留英文句子 |

mushroom 的红底白斑卡通图近似毒蝇伞，却配烹饪例句，建议优先换常见食用蘑菇图。这是对图文组合的判断，不是凭卡通图鉴定物种；毒蝇伞的外观和毒性参见 [Naturalis 图鉴](https://mushrooms.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/taxon.php?id=100098)。

## 判断边界

- 图片应先准确表达所选词义。具体名词应画对对象；部位应标示目标；动词应呈现动作。抽象词可以使用情境图，不要求脱离文字独立猜中。
- 图与例句描述相反时优先改；同一词义下的不同有效例子列为可优化项。例如书和苹果能表达 and，尽管例句写笔和书。
- 译文允许自然表达，不按是否逐字对应判错。quite 的“我很饿”保留；favorite 当前名词例句与释义一致，也保留。
- 放大复核后，hour 的一小时跨度、continent 的非洲地图、participate 的完整人物均正确，已剔除初审误判。genuine / distinguish 不能凭外观断真伪或材质，不要求添加虚假的视觉鉴定特征。
- 高中词汇包含较复杂的例句，不应因为资源齐全就视为全部适合 GK 独立学习；例如 characteristic tenacity 应由家长结合语境讲解，后续可再做例句难度优化。本轮没有据此删除词或改教学顺序。

## 证据与后续修改位置

87 张总览图覆盖全部 ${seen.size} 张词卡；图中四项文字均未截断。全部图片可解码，四项内容无空缺，复核期间图片哈希未变化。逐词快照记录图片 SHA-256 和内容 SHA-256；重新生成报告前会检查工作区是否仍与审阅快照一致。

资源覆盖与语义质量是不同维度：现有 ready / pending 只表示可用资源是否齐全，不能代替本表的质量结论。本轮没有修改应用词卡、图片、音频或学习记录，没有提交或部署，也没有改 Git 暂存区。

文字源位于 data/picture-vocabulary.tsv、data/vocabulary/primary-context.tsv、extended-context.json、wonders-gk-cards.json，以及 app/course-content.js 的基础词；app/context-words.js 等是生成结果，应改源后编译。图片在 assets/pictures/，情境图的配方位于 data/vocabulary/context-recipes.tsv、scripts/pictures/context-batch-01.mjs 和相关绘图脚本。已有 scene-armchair、scene-lake、scene-mud、scene-dental-xray 等组件可复用，但仍需检查最终缩略图。

25 张合成图的版权组件快照直接引用了本轮优先修改或义项待定的图片，列表保存在 JSON 的 componentConsumersToRecheck。合成 SVG 嵌入的是组件副本：换基础图后还要核对并重新生成受影响的合成图、版权哈希和离线包。改英文例句时需同步中文例句并重生成句音；只改图片或中文不需要无故重生成英文音频。修复具体物体后也要检查同图出题分组；情境图继续排除识图题和自动掌握。

复核快照：node scripts/render-vocabulary-quality-review.mjs --check；生成本报告与图文页：node scripts/render-vocabulary-quality-review.mjs。本脚本不产生新的语义判断，也不加入应用构建。

## 逐词修改建议

| 优先级 | 单词 | 字段 | 问题 | 建议 |
|---|---|---|---|---|
${flagged.map(c=>c.findings.map(f=>`| ${labels[c.reviewStatus]} | ${cell(c.id)} | ${cell(f.field)} | ${cell(f.issue)} | ${cell(f.suggestion)} |`).join('\n')).join('\n')}
`;

const payload=JSON.stringify(report.cards).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全词库图文质量初审</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f5f6;color:#17252a;font:16px/1.55 system-ui,-apple-system,'PingFang SC',sans-serif}header,main{max-width:1400px;margin:auto;padding:20px}h1{font-size:26px;margin:0 0 10px}.intro{max-width:1000px;color:#526068}.controls{display:flex;gap:12px;flex-wrap:wrap;position:sticky;top:0;background:#f3f5f6;padding:14px 0;z-index:1}input,select,button{font:inherit;padding:10px;border:1px solid #acb9be;border-radius:8px;background:white}input{flex:1;min-width:220px}#cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}article{background:white;padding:16px;border-radius:12px;border:1px solid #d8dfe2}h2{font-size:20px;margin:8px 0}img{width:100%;height:220px;object-fit:contain}p{margin:8px 0;overflow-wrap:anywhere}.badge{font-size:13px;border-radius:5px;padding:4px 7px;background:#edf1f4}.priority_fix{color:#9c281d;background:#fff0ec}.sense_choice{color:#62328b;background:#f3eafa}.improvement{color:#805b08;background:#fff7d9}.zh{color:#176145}.note{border-top:1px solid #e4e9ec;padding-top:8px}small{color:#5f6e76}#more{display:block;margin:25px auto}.empty{padding:30px}a{color:#23618b}</style>
<header><h1>全词库图文质量初审 · ${report.reviewedOn}</h1><p class="intro">已逐张初审 ${seen.size} 张规范词卡的图片、释义和双语例句。${counts.priority_fix} 张优先修改，${counts.improvement} 张建议优化，${counts.sense_choice} 张先确定义项；${counts.no_obvious_issue} 张本轮未见明显问题。本轮尚未修改应用内容，不是教师认证或无错保证。</p><p class="intro">图片从当前工作区读取，后续替换会显示新图；本页文字与结论对应 JSON 中记录的审阅快照。<a href="vocabulary-quality-review.md">完整报告</a></p></header>
<main><div class="controls"><input id="search" type="search" aria-label="搜索单词、释义、例句、问题" placeholder="搜索单词、释义、例句、问题"><select id="status" aria-label="筛选结论"><option value="priority_fix">优先修改 · ${counts.priority_fix}</option><option value="improvement">建议优化 · ${counts.improvement}</option><option value="sense_choice">义项待确定 · ${counts.sense_choice}</option><option value="no_obvious_issue">本轮未见明显问题 · ${counts.no_obvious_issue}</option><option value="all">全部 ${seen.size} 张</option></select></div><p id="count" aria-live="polite"></p><div id="cards"></div><button id="more">再显示 60 张</button></main>
<style>#more[hidden]{display:none}</style>
<script type="application/json" id="data">${payload}</script><script>
const cards=JSON.parse(document.querySelector('#data').textContent),labels=${JSON.stringify(labels)},rank=${JSON.stringify(rank)};
const search=document.querySelector('#search'),status=document.querySelector('#status'),container=document.querySelector('#cards'),more=document.querySelector('#more');let limit=60;
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function render(){const q=search.value.trim().toLowerCase();const found=cards.filter(c=>(status.value==='all'||c.reviewStatus===status.value)&&(!q||[c.id,c.display,c.zh,c.sentence,c.sentenceZh,...c.findings.flatMap(f=>[f.issue,f.suggestion])].join(' ').toLowerCase().includes(q))).sort((a,b)=>rank[a.reviewStatus]-rank[b.reviewStatus]||a.index-b.index);
document.querySelector('#count').textContent='匹配 '+found.length+' 张，显示 '+Math.min(limit,found.length)+' 张';
container.innerHTML=found.slice(0,limit).map(c=>'<article data-id="'+esc(c.id)+'"><span class="badge '+c.reviewStatus+'">'+labels[c.reviewStatus]+'</span><h2>'+esc(c.display)+' · '+esc(c.zh)+'</h2><img loading="lazy" alt="'+esc(c.display)+' 当前配图" src="../'+esc(c.image.replace(/^\\.\\//,''))+'"><small>'+esc(c.pos)+(c.pictureCue?' · 情境提示图':' · 直接识图')+'</small><p lang="en">'+esc(c.sentence)+'</p><p class="zh">'+esc(c.sentenceZh)+'</p>'+c.findings.map(f=>'<div class="note"><p><strong>问题：</strong>'+esc(f.issue)+'</p><p><strong>建议：</strong>'+esc(f.suggestion)+'</p></div>').join('')+'</article>').join('');
if(!found.length)container.innerHTML='<p class="empty">没有匹配的词卡。</p>';more.hidden=found.length<=limit;}
for(const el of [search,status])el.addEventListener(el===search?'input':'change',()=>{limit=60;render();});more.addEventListener('click',()=>{limit+=60;render();});render();
</script></html>`;
await writeFile(new URL('docs/vocabulary-quality-review.md',root),md);
await writeFile(new URL('docs/vocabulary-quality-review.html',root),html);
console.log(JSON.stringify({reviewed:seen.size,flagged:flagged.length,summary:counts,outputs:['docs/vocabulary-quality-review.md','docs/vocabulary-quality-review.html']}));
