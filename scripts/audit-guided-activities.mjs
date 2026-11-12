import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {READY_WORDS,WORDS} from '../web/app/course-content.js';
import {activityFor} from '../web/app/guided-activities.js';
import {ACTIVITY_PROFILES} from '../web/app/guided-activity-profiles.js';
import {GUIDED_PLAN_FINGERPRINT,GUIDED_WORD_PLANS} from '../web/app/guided-word-plans.js';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path.startsWith('assets/')||path.startsWith('./assets/')?'web/'+path:path,root),'utf8').then(JSON.parse);
const baseline=await json('data/vocabulary/guided-activity-baseline.json'),before=new Map(baseline.entries.map(row=>[row.id,row]));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const count=(rows,key)=>rows.reduce((counts,row)=>{const name=key(row);counts[name]=(counts[name]||0)+1;return counts;},{});
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const checks={
 hand:'body',a:'language',an:'language',can:'language',spring:'time',fall:'time',wave:'nature',fly:'animal',brush:'object',drink:'food',
 match:'photo-tool',patient:'social-quality',anxious:'emotion',observe:'action-scene','observe-watch':'motor',state:'geography',capital:'geography',
 material:'written-content',energy:'emotion',virus:'digital',natural:'quality-scene',top:'toy',one:'quantity',already:'time',always:'frequency',
 blind:'accessibility',deaf:'accessibility',sleeve:'clothing-part',tail:'animal-part',once:'quantity',twice:'quantity',rather:'language',
};
const rows=[];
for(const word of READY_WORDS){
 const activity=activityFor(word),old=before.get(word.id);
 assert.ok(GUIDED_WORD_PLANS[word.id],`Missing explicit plan: ${word.id}`);
 assert.ok(['curated','profile'].includes(activity.source),`Unexpected fallback: ${word.id}`);
 for(const key of ['setup','teach','listen','recall','transfer','focus','scene','modelText','modelZh']){
  assert.ok(typeof activity[key]==='string'&&activity[key].trim(),`Missing ${key}: ${word.id}`);
  assert.doesNotMatch(activity[key],/\{(?:m|scene|focus)\}|undefined|\[object Object\]/,`Unresolved content: ${word.id}`);
 }
 assert.match(activity.modelZh,/[\u3400-\u9fff]/,`Missing Chinese explanation: ${word.id}`);
 const target=(word.display||word.id).toLowerCase();
 const variants=[target,target+'s',target+'es',target+'ed',target+'ing',...(/y$/.test(target)?[target.slice(0,-1)+'ies',target.slice(0,-1)+'ied']:[])];
 assert.ok(variants.some(form=>new RegExp('\\b'+escape(form)+'\\b','i').test(activity.modelText)),`Example omits target word: ${word.id}`);
 if(activity.pictureChoice){assert.equal(word.pictureCue,false,`Context image quiz: ${word.id}`);assert.ok(!word.pos||word.pos==='名词',`Non-noun image quiz: ${word.id}`);}
 if(['限定词','代词','助动词','情态动词','连词'].includes(word.pos)){
  assert.equal(activity.pictureChoice,false,`Function word image quiz: ${word.id}`);assert.equal(activity.contextual,true,`Missing language context: ${word.id}`);
 }
 if(checks[word.id])assert.equal(activity.profile,checks[word.id],`Wrong sense strategy: ${word.id}`);
 const oldComparable=['setup','teach','listen','transfer'].map(key=>activity[key]);
 rows.push({id:word.id,zh:word.zh,focus:activity.focus,profile:activity.profile,strategy:activity.label,source:activity.source,
  contextual:activity.contextual,extension:activity.extension,pictureChoice:activity.pictureChoice,setup:activity.setup,
  scene:activity.scene,modelText:activity.modelText,modelZh:activity.modelZh,
  instructionHash:digest(['setup','teach','listen','recall','transfer'].map(key=>activity[key])),
  instructionTextChanged:!old||old.sha256!==digest(oldComparable)});
}
assert.equal(new Set(rows.map(row=>row.id)).size,READY_WORDS.length);
assert.equal(Object.keys(GUIDED_WORD_PLANS).length,READY_WORDS.length,'Registry/corpus mismatch');
const counts=count(rows,row=>row.profile);
assert.equal(Object.keys(counts).length,Object.keys(ACTIVITY_PROFILES).length,'Unused strategy must be reviewed or removed');
const report={version:1,method:'Full-corpus contract checks plus AI semantic grouping and targeted sense corrections. Not teacher review or child/device validation.',
 fingerprint:GUIDED_PLAN_FINGERPRINT,total:READY_WORDS.length,rawCards:WORDS.length,aliases:WORDS.length-READY_WORDS.length,missing:0,
 baselineBuild:baseline.buildVersion,instructionTextChanged:rows.filter(row=>row.instructionTextChanged).length,
 strategies:counts,sources:count(rows,row=>row.source),contextual:rows.filter(row=>row.contextual).length,
 extension:rows.filter(row=>row.extension).length,pictureChoiceEligible:rows.filter(row=>row.pictureChoice).length,rows};
const path=new URL('data/vocabulary/guided-activities-audit.json',root);
if(process.argv.includes('--check'))assert.deepEqual(await json('data/vocabulary/guided-activities-audit.json'),report,'Guided review report is stale; run npm run audit:guided');
else{
 await writeFile(path,JSON.stringify(report,null,1)+'\n');
 const sampleIds=['hand','a','an','my','because','already','always','sleeve','tail','spring','fall','fly','wave','drink','brush','patient','anxious','observe','observe-watch','match','shoot','material','energy','blind','cancer','radium'];
 const examples=sampleIds.map(id=>{const row=rows.find(row=>row.id===id);return `| ${id} | ${row.focus.replaceAll('|','／')} | ${row.strategy} | ${row.setup.replaceAll('|','／')} |`;}).join('\n');
 const table=Object.entries(counts).map(([profile,total])=>`| ${profile} | ${ACTIVITY_PROFILES[profile].label} | ${total} |`).join('\n');
 const body=`# 一起学：全词库玩法检查\n\n范围为当前 ${READY_WORDS.length} 个规范可学词，原始卡片 ${WORDS.length} 张，其余为别名卡。所有词均有明确方案，缺失 0。\n\n本次是全量程序核对、AI 语义分组复查和重点义项修订，不是 ${READY_WORDS.length} 份由教师逐一精修、或经过儿童验证的独立教案。\n\n## 本次结果\n\n- ${Object.keys(counts).length} 种教学策略，独立于词库浏览主题；每个词在登记表中明确绑定策略、当前义项和例句快照。\n- ${report.sources.curated} 个词使用具体编写的步骤或情境，${report.sources.profile} 个词使用已归类策略并绑定自身义项、中文情境和英文例句。\n- 相比调整前构建 ${baseline.buildVersion}，${report.instructionTextChanged} 个词的准备／教学／听懂／迁移文本发生变化。文本变化数不等于质量评分。\n- ${report.contextual} 个词使用短句或情境辅助；${report.extension} 个词附中文概念准备提醒；${report.pictureChoiceEligible} 个词允许在图片确实直接表义时进入图片选择。\n- 名词可以练命名；功能词、时态词练在短话或自然回应中使用。跟读和识别不直接计为独立表达。\n- 5 岁初学者不必马上掌握所有拓展词。先检查中文概念是否熟悉；不熟时跳过，保留以后学习的路径。\n\n## 发现与修订\n\n1. 浏览主题不能决定玩法：手和眼睛需要指身体部位，冠词需要短语，衣物与植物部位不能当整体命名。\n2. 不能按熟悉的英文同形词套义项：春天／弹簧、海浪／挥手、苍蝇／飞、火柴／比赛、遵守／观察等均按当前卡片义项处理。\n3. 位置、数量、时间、次数、频率、程度、情绪和行为品质分别设计活动。左右以孩子方向为准；冠词先听熟短语，不用孩子尚不会的识字规则来考。\n4. 抽象词绑定具体中文例子，功能词提供熟悉短话，不要求给抽象概念找实物，也不靠图上一个物体判断整句词义。\n5. 工具、药品、疾病、危险现象采用看图或温和故事；不实际操作、制造病痛、伤害或受惊。失明／听不见采用尊重个体的支持方式介绍，不蒙眼捂耳模仿。\n6. 上次未完成的旧图片题如已不适合，会转换为家长引导理解，并重听新的示范；保留已曝光提示与长期记忆记录。\n\n## 重点例子\n\n| 词 | 本次义项 | 玩法 | 准备方式 |\n|---|---|---|---|\n${examples}\n\n## 全量分类统计\n\n| 策略键 | 家长看到的玩法 | 词数 |\n|---|---|---:|\n${table}\n\n## 内容源与后续维护\n\n- 登记表：data/vocabulary/guided-word-plans.json。每个规范词恰有一条记录，义项、词性和原例句变化时必须复核。\n- 专门情境：data/vocabulary/guided-scenes.json。可覆盖准备、演示、理解、回想、迁移及项目编写的短句。\n- 共享玩法：app/guided-activity-profiles.js。不要重新用浏览主题自动决定语法词、抽象词和具体物的教学方式。\n- 编译结果：app/guided-word-plans.js，由脚本生成。缺词、重复、未知分类、例句漂移或孤立情境会阻止构建。\n- 全量核对表：data/vocabulary/guided-activities-audit.json，逐词列出分类、义项、准备、情境和示范短句。指令哈希只用于检测变化，不是教学质量认证。\n- 原单词音频保持使用录音。情境示范优先复用相同例句的已有音频规则；新编短句使用家长所选英文系统音色和语速，不伪装成已有录音。\n- 本地修改中文义项后，不自动套用原义项的专门玩法；改用家长确认的情境。已有例句署名在展示时保留。\n\n验证命令：\n\n\`\`\`sh\nnode scripts/compile-guided-activities.mjs --check\nnpm run audit:guided\nnpm test\nnpx playwright test tests/browser/guided-words.spec.js --project=iPad-chromium --project=iPad-webkit --project=phone-chromium\n\`\`\`\n\n这些检查验证覆盖、内容绑定、出题与播放流程；真实 iPad 发音、家长是否容易操作及儿童学习效果仍需实际使用确认。\n`;
 await writeFile(new URL('docs/guided-activities-review.md',root),body);
}
console.log(JSON.stringify({...report,rows:rows.length}));
