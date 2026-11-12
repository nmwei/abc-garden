// Canonical completion scope is separate from historical raw-source picture counts.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CATALOG_BY_ID,READY_WORDS,PENDING_WORDS} from '../domain/course-content.js';
import {auditTarget} from './audit-wonders-gk.mjs';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path.startsWith('assets/')||path.startsWith('./assets/')?'web/'+path:path,root),'utf8').then(JSON.parse);
export async function auditCompletion(plan){
 const baseline=new Set(plan.baselineIds),planned=new Set(),rows=[];
 if(plan.baselineCount!==1195||baseline.size!==plan.baselineCount||plan.baselineIds.length!==baseline.size)throw Error('Invalid completion baseline');
 for(const id of baseline)if(!CATALOG_BY_ID.has(id))throw Error(`Lost baseline card: ${id}`);
 const mappings=await json('data/vocabulary/picture-mappings.json'),credits=await json('assets/credits.json');
 const clips=new Map((await json('assets/audio/course-sources.json')).clips.map(c=>[c.key,c]));
 const pronunciations=await json('data/vocabulary/context-pronunciations.json');
 const offline=await json('dist/precache.json'),files=new Set(offline.packs.find(p=>p.id==='all').files);
 const batches=new Set();
 for(const batch of plan.batches){
  if(!/^\d{2}$/.test(batch.id)||batches.has(batch.id))throw Error(`Invalid batch: ${batch.id}`);
  batches.add(batch.id);
  for(const card of batch.cards){
   const word=CATALOG_BY_ID.get(card.id);
   if(!baseline.has(card.id)||planned.has(card.id))throw Error(`Duplicate or out-of-scope card: ${card.id}`);
   planned.add(card.id);
   for(const key of ['zh','pos','sentence','sentenceZh'])if(word[key]!==card[key])throw Error(`Re-review ${card.id}: changed ${key}`);
   if(!card.reviewNote||!card.pictureCue||!word.pictureCue||word.topic!==card.topic||mappings[card.id]?.completionBatch!==batch.id||mappings[card.id]?.review!==card.reviewNote)throw Error(`Invalid contextual picture: ${card.id}`);
   const checked=await auditTarget({spelling:word.display||card.id,cardId:card.id,reviewedCard:card});
   if(checked.status!=='ready')throw Error(`${card.id}: ${checked.issues.join(',')}`);
   const picture=await readFile(new URL('web/'+word.image,root));
   const credit=credits.find(c=>c.file===word.image.replace('./assets/',''));
   if(credit?.sha256!==createHash('sha256').update(picture).digest('hex'))throw Error(`Picture credit hash mismatch: ${card.id}`);
   for(const component of credit.components||[]){
    const current=credits.find(c=>c.file===component.file);
    const bytes=await readFile(new URL(`web/assets/${component.file}`,root));
    if(!current||current.license!==component.license||createHash('sha256').update(bytes).digest('hex')!==component.sha256)throw Error(`Stale component: ${card.id}/${component.file}`);
    if(component.license==='Apache-2.0'&&credit.license!=='Apache-2.0')throw Error(`Lost component license: ${card.id}`);
   }
   for(const [key,text] of [[word.audio,word.spoken||word.display||word.id],[`sentence-${word.id}`,word.sentence]]){
    const override=pronunciations[key];
    if(override&&(override.text!==text||clips.get(key)?.phonemes!==override.phonemes))throw Error(`Stale pronunciation: ${key}`);
    const audio=await readFile(new URL(`web/assets/audio/${key}.wav`,root));
    // RIFF PCM files from this pipeline use the canonical 44-byte header.
    let peak=0;for(let i=44;i+1<audio.length;i+=2)peak=Math.max(peak,Math.abs(audio.readInt16LE(i)));
    if(peak<10)throw Error(`Silent audio: ${key}`);
   }
   for(const file of [word.image,`./assets/audio/${word.audio}.wav`,`./assets/audio/sentence-${word.id}.wav`]){
    if(!files.has(file))throw Error(`Missing offline resource: ${file}`);
    const hash=createHash('sha256').update(await readFile(new URL('web/'+file,root))).digest('hex');
    if(offline.resources[file]?.sha256!==hash)throw Error(`Stale build resource: ${file}`);
   }
   rows.push({batch:batch.id,id:card.id,zh:word.zh,status:'ready',pictureCue:true});
  }
 }
 for(const id of baseline)if(!planned.has(id)&&CATALOG_BY_ID.get(id).image)throw Error(`Picture completed without review: ${id}`);
 return {baseline:baseline.size,completed:rows.length,remaining:baseline.size-rows.length,catalog:{ready:READY_WORDS.length,pending:PENDING_WORDS.length},batches:plan.batches.map(b=>({id:b.id,count:b.cards.length})),rows,remainingIds:plan.baselineIds.filter(id=>!planned.has(id)),reviewBoundary:'Sense/example and rendered-picture review by model; media format, text, pronunciation override, component provenance and offline-hash checks are automated. No teacher pronunciation certification or physical iPad acceptance.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const report=await auditCompletion(await json('data/vocabulary/context-completion-plan.json'));
 await writeFile(new URL('data/vocabulary/context-completion-report.json',root),JSON.stringify(report,null,2)+'\n');
 await writeFile(new URL('docs/context-completion.md',root),`# 待完善词汇补全台账\n\n固定范围：2026-11-02 开始前的 ${report.baseline} 张规范待完善词卡。\n\n已补全 ${report.completed}；剩余 ${report.remaining}。当前全库可学习 ${report.catalog.ready}；待完善 ${report.catalog.pending}。\n\n分 12 批完成全部 1,195 个词。全部使用情境提示图，保留看图测验与自动掌握的排除规则；抽象词结合当前释义和双语例句理解。图片由项目原创 SVG 与已注明来源和许可的本地矢量组件构图，组件哈希与继承许可一并记录。\n\n复用并校验已有词音、句音；改写 abandon、ability、abnormal、accept、account、central、forget 七条例句。按动词义修正 live、use、conduct、object、decrease、suspect、graduate 的单词读音，并修正 conduct、object、decrease 的句中音素，共更新 7 条词音和 10 条句音。next 按 next week 修正词性；distant 按亲属关系例句修正释义。\n\n## 维护方式\n\n1. 固定基线 ID 保留在 context-completion-plan.json，追加批次，不重建基线。\n2. 每张图记录释义、词性、双语例句快照和设计说明；内容变化后必须重新核对。\n3. 修改 context-recipes.tsv 或第一批设计 → node scripts/generate-context-symbols.mjs → node scripts/plan-context-recipes.mjs → node scripts/generate-context-pictures.mjs → 编译词库 → 按需生成音频 → npm run build → npm run audit:completion。\n4. 使用浏览器检查图片解码、缩略图语义、选词与离线播放；每批记录实际验证证据。\n\n自动审计校验范围闭合、内容快照、图片版权哈希、音频文本与显式音素、PCM 非静音及离线资源哈希。文件检查不代替图片语义审核或教师逐条听读；桌面 WebKit 不代表真实 iPad 验收。历史 picture-coverage.json 按原始素材统计，此表按规范词卡统计。\n\n## 已补全词卡\n\n| 批次 | 单词 | 释义 | 图片类型 |\n|---|---|---|---|\n${report.rows.map(r=>`| ${r.batch} | ${r.id} | ${r.zh} | 情境提示 |`).join('\n')}\n`);
 console.log(JSON.stringify({baseline:report.baseline,completed:report.completed,remaining:report.remaining,catalog:report.catalog}));
}
