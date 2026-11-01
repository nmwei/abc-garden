// Source-backed maintenance report; official scope coverage and classroom alignment are distinct.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CATALOG_BY_ID} from '../app/course-content.js';
import {canonicalWordId} from '../app/word-aliases.js';
import {sentenceMeaning} from '../app/sentence-meanings.js';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const audioSource=await json('assets/audio/course-sources.json');
const clips=new Map(audioSource.clips.map(c=>[c.key,c]));
const pronunciations=await json('data/vocabulary/wonders-gk-pronunciations.json');
const scope=await json('data/vocabulary/wonders-gk-scope.json');
const labels={ready:'可学习',missing:'未收录',picture:'待补图',content:'内容不完整',audio:'音频缺失、文本或读音版本不符',review:'课内词义需复核'};
const roleLabels={'word-list':'课堂词表',reading:'课堂课文',oral:'口语词','high-frequency':'高频词','word-bank':'词库补充',spelling:'拼写例词'};
const targetId=t=>canonicalWordId(t.cardId||t.spelling.toLowerCase());
export async function auditTarget(target,{catalog=CATALOG_BY_ID,read=readFile}={}){
 const id=targetId(target),word=catalog.get(id);
 const result={spelling:target.spelling,id,role:target.role,roles:target.roles||[target.role],source:target.source,meaningNote:target.meaningNote,issues:[]};
 if(!word)return {...result,status:'missing',issues:['missing']};
 const reviewed=target.reviewedCard;
 const sameSpelling=canonicalWordId((word.display||word.id).toLowerCase())===canonicalWordId(target.spelling.toLowerCase());
 if(!sameSpelling||!reviewed||reviewed.id!==id||reviewed.zh!==word.zh||reviewed.sentence!==word.sentence)result.issues.push('review');
 if(!word.zh||!word.sentence||!(word.sentenceZh||sentenceMeaning(word.sentence)))result.issues.push('content');
 if(!word.image)result.issues.push('picture');
 else try{await read(new URL(word.image,root));}catch{result.issues.push('picture');}
 for(const [key,text] of [[word.audio,word.spoken||word.display||word.id],[`sentence-${word.id}`,word.sentence]]){
  try{
   if(clips.get(key)?.text!==text)throw Error('Stale audio text');
   if(pronunciations[key]&&(pronunciations[key].text!==text||clips.get(key)?.phonemes!==pronunciations[key].phonemes))throw Error('Stale pronunciation');
   const bytes=await read(new URL(`assets/audio/${key}.wav`,root));
   if(bytes.length<100||bytes.toString('ascii',0,4)!=='RIFF'||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(34)!==16)throw Error('Invalid PCM16');
  }catch{result.issues.push('audio');break;}
 }
 return {...result,status:result.issues[0]||'ready',pictureCue:word.pictureCue};
}
const tally=rows=>({ready:rows.filter(t=>t.status==='ready').length,total:rows.length});
export async function auditCurriculum(manifest){
 if(manifest.weeks.length!==33)throw Error('Expected 33 teaching weeks');
 return Promise.all(manifest.weeks.map(async(week,index)=>{
  if(week.id!==`u${Math.floor(index/3)}w${index%3+1}`)throw Error(`Invalid teaching order: ${week.id}`);
  if(week.materialReview!=='reviewed'&&week.targets.length)throw Error(`Unreviewed classroom targets: ${week.id}`);
  const official=week.officialTargets||[],source=scope.weeks.find(w=>w.id===week.id);
  const expected=new Set(['oral','highFrequency','wordBank','spelling'].flatMap(k=>source[k].map(s=>s.toLowerCase())));
  const found=new Set(official.map(t=>t.spelling.toLowerCase()));
  if(expected.size!==found.size||[...expected].some(s=>!found.has(s)))throw Error(`Official target extraction gap: ${week.id}`);
  for(const rows of [week.targets,official]){
   const seen=new Set();
   for(const t of rows){
    const id=targetId(t);if(seen.has(id)||!manifest.sources[t.source?.id]||!t.source.pages?.length)throw Error(`Invalid target: ${week.id}/${id}`);
    seen.add(id);
   }
  }
  const classroom=await Promise.all(week.targets.map(t=>auditTarget(t)));
  const officialTargets=await Promise.all(official.map(t=>auditTarget(t)));
  const targets=[...new Map([...classroom,...officialTargets].map(t=>[t.id,t])).values()];
  return {id:week.id,title:week.title,referencePage:week.referencePage,materialReview:week.materialReview,
   wordList:tally(classroom.filter(t=>t.role==='word-list')),official:tally(officialTargets),classroomTargets:classroom,officialTargets,targets};
 }));
}
export async function writeReport(){
 const manifest=await json('data/vocabulary/wonders-gk.json'),weeks=await auditCurriculum(manifest);
 const current=weeks.find(w=>w.id===manifest.currentWeek);if(!current)throw Error('Current week is missing');
 const official=[...new Map(weeks.flatMap(w=>w.officialTargets).map(t=>[t.id,t])).values()];
 const known=[...new Map(weeks.flatMap(w=>w.targets).map(t=>[t.id,t])).values()];
 const summary={weeks:weeks.length,officialUnique:tally(official),allKnownUnique:tally(known),officialOccurrences:weeks.reduce((n,w)=>n+w.official.total,0)};
 const status=t=>t.issues.length?t.issues.map(i=>labels[i]).join('；'):labels.ready;
 const lines=['# Wonders GK 教材覆盖清单','',
  '由 `npm run audit:wonders` 生成。目标维护于 `data/vocabulary/wonders-gk.json`，官方列提取保存于 `wonders-gk-scope.json`。','',
  `官方 33 周明确列出的去重词项：${summary.officialUnique.ready}/${summary.officialUnique.total} 可学习；含课堂补充共 ${summary.allKnownUnique.ready}/${summary.allKnownUnique.total} 张用法卡。`,
  `按周去重后共有 ${summary.officialOccurrences} 次目标出现；跨周复习共用词卡。`,'',
  '覆盖口语词、高频词、Build Your Word Bank 和 Spelling 中明确列出的例词。主题分类标题不擅自扩成官方必学词，字母组合、音素、书名和教师指令不计为词汇。',
  '覆盖本参考纲要不代表覆盖所有课本正文；课堂具体版本仍未确认。官方没有给出逐词释义，用法按单元语境由项目编写／核对，不宣称出版社或教师逐项认证。','',
  `## 当前课堂周：${current.id.toUpperCase()}`,'',`五词表：${current.wordList.ready}/${current.wordList.total} 可学习。`,'',
  '| 词项 | 类别 | 当前含义 | 状态 |','| --- | --- | --- | --- |',
  ...current.classroomTargets.map(t=>`| ${t.spelling} | ${roleLabels[t.role]} | ${t.meaningNote} | ${status(t)} |`),'',
  '## 33 周官方目标','',`[McGraw Hill 官方 Grade K 纲要](${manifest.sources['official-scope'].url})（PDF 页码见表）。课堂材料核对与官方目标覆盖分别记录。`,'',
  '| 周次 | 主题 | 页 | 官方目标 | 课堂材料 |','| --- | --- | --- | --- | --- |',
  ...weeks.map(w=>`| ${w.id.toUpperCase()} | ${w.title} | ${w.referencePage} | ${w.official.ready}/${w.official.total} | ${w.materialReview==='reviewed'?'已核对':'未提供'} |`),'',
  '## 按周词汇与待办','',
  ...weeks.flatMap(w=>[`### ${w.id.toUpperCase()} · ${w.title}`,'',
   ...['oral','high-frequency','word-bank','spelling'].map(role=>`${roleLabels[role]}：${w.officialTargets.filter(t=>t.roles.includes(role)).map(t=>t.spelling).join('、')||'无明确列项'}。`),
   `待办：${w.officialTargets.filter(t=>t.status!=='ready').map(t=>`${t.spelling}（${status(t)}）`).join('；')||'无内容／媒体缺口'}。`,'']),
  '## 内容维护与验证边界','',
  '- 同拼写的不同义项使用独立 cardId，例如 train-pet、saw-see、sort-group；不覆盖火车、锯子、种类的旧卡和掌握记录。义项例句修改后，reviewedCard 快照会提示重新核对。',
  '- 数据 sources 保存原文词形和页／列；屈折词形独立收录，不用自动还原词形虚报覆盖。原始纲要的 U2W1 高频列写 we、Spelling 写 a，保留两列证据。',
  '- 图片按具体例句或明确教学语境绘制。语法词、抽象词及需要前后过程的词为 pictureCue，只做语境听读，不作为看图辨义的题目或自动掌握证据。',
  '- 词义与双语例句：wonders-gk-cards.json；图片：wonders-gk-picture-plan.json 和 scripts/pictures/wonders-scenes.mjs；编译、生成图片及音频后构建，再执行 npm run audit:wonders。',
  '- 英文音频为本地 Kokoro 合成参考；content 的形容词重音通过已记录的音素输入修正。媒体与文本／音素版本检查不等于逐条教师发音审核或真实儿童学习验收。',
  '- 教材 PDF 不进入公开网页；图片为项目原创 SVG，保留逐文件 CC0 版权和哈希记录。',''];
 await writeFile(new URL('data/vocabulary/wonders-gk-coverage.json',root),JSON.stringify({currentWeek:manifest.currentWeek,summary,weeks},null,2)+'\n');
 await writeFile(new URL('docs/wonders-gk-coverage.md',root),lines.join('\n'));
 console.log(JSON.stringify(summary));
 if(summary.officialUnique.ready!==summary.officialUnique.total)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await writeReport();
