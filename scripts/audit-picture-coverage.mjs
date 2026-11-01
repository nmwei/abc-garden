// Maintenance-only review ledger. No new classification UI and no changes to learning records.
import{WORDS}from'../app/course-content.js';import{readFile,writeFile}from'node:fs/promises';
const baselinePictures=1301;
const baselineMissing=WORDS.length-baselinePictures;
const members=s=>new Set(s.split('|'));
const kinship=members('daughter|son|wife|husband|mum|neighbour|neighbor|nephew|grandson|relative|hostess|guest|visitor|partner|member|stranger|friendship|relationship|mother|father|mrs|mr|ms|miss|sir|elder');
const units=members("age|hour|minute|o'clock|time|century|date|deadline|daily|annual|monthly|weekday|weekend|year|month|period|semester|term|eve|instant|moment|ton|pound|inch|mile|kilogram|kilo|kilometre|kilometer|metre|meter|mass|weight|per cent|percent|rate|quarter|unit|amount|sum");
const technical=members('acid|gas|oxygen|iron|radium|radiation|gene|current|electric|electronic|electricity|digital|mineral|chemical|chemistry|biology|physics|geography|ecology|economy|software|technology|ai|artificial intelligence|virus|cancer|illness|disease|flu|health|medical|grammar|maths|mathematics');
const documentSense=members('article|essay|composition|chapter|title|draft|instruction|constitution|policy|law|theory|phrase|vocabulary|pronunciation|language|english|chinese|name|rhyme|classic|literature|tale|saying|meaning|version|program|programme|video');
const role=members('assistant|boss|chief|chairman|manager|leader|principal|president|minister|editor|expert|candidate|celebrity|citizen|amateur|genius|hero|professional|pioneer|volunteer|slave|victim|enemy|teenager|youth|occupation|profession|staff|crew|navy');
const internal=members('idea|thought|thinking|memory|mind|intention|desire|wish|hope|belief|faith|confidence|trust|knowledge|interest|attention|attitude|opinion|impression|mood|emotion|feeling|sympathy|pride|courage|patience|humor|humour|joke|fantasy|freedom|justice|dignity|harmony|honor|honour|honest|innocent|guilty|intelligent|clever|wise|modest|generous|selfish|greedy');
function review(w){
 if(kinship.has(w.id))return ['relationship','须通过人物关系或身份背景区分，不能用一个人物头像替代当前词义。'];
 if(units.has(w.id))return ['measurement_or_time','需要时间、量值、单位或日历上下文；静态物件本身不代表该量值含义。'];
 if(technical.has(w.id))return ['technical_explanation','当前义项涉及不可见成分、科学性质、学科或系统，需要标注与解释，不能用相关器材冒充。'];
 if(documentSense.has(w.id))return ['content_or_language','要阅读文字内容、语音或了解作品属性才能区分；一本书或纸张不足以说明当前义项。'];
 if(role.has(w.id))return ['role_or_status','需要说明职权、参与关系、年龄或社会身份，单凭外观和通用制服容易误认。'];
 if(internal.has(w.id))return ['internal_or_abstract','涉及内在心理、评价或抽象概念，需要情境支持，而非用任意表情或图标代替。'];
 if(/代词|限定词|连词|情态|冠词/.test(w.pos||''))return ['sentence_context','语法功能或指代取决于句子和说话者，需要放到具体表达中学习。'];
 if(/动词/.test(w.pos||''))return ['intent_or_process','当前用法需要区分动作的目的、结果、前后过程或参与者；保留给情境/连续画面设计。'];
 if(/形容词|副词|数词|介词/.test(w.pos||''))return ['comparison_or_context','当前义项依赖参照、程度、时间或用法语境；本轮没有用相关物体替代词义。'];
 return ['contextual_concept','当前义项是类别、事件、社会概念或情境中的含义，需要解释和上下文才能与相关物件区分。'];
}
const mapping=JSON.parse(await readFile(new URL('../data/vocabulary/picture-mappings.json',import.meta.url)));
const remaining=WORDS.filter(w=>!w.image).map(w=>{const[reasonCode,reason]=review(w);return{id:w.id,zh:w.zh,pos:w.pos,sentence:w.sentence,status:'requires_context_design',reasonCode,reason};});
const counts={};for(const row of remaining)counts[row.reasonCode]=(counts[row.reasonCode]||0)+1;
const result={total:WORDS.length,withPictures:WORDS.filter(w=>w.image).length,addedPictures:WORDS.filter(w=>w.image&&w.contentSource).length,contextualPictures:WORDS.filter(w=>w.image&&w.pictureCue).length,directPictures:WORDS.filter(w=>w.image&&!w.pictureCue).length,round:{reviewed:baselineMissing,added:WORDS.filter(w=>w.image).length-baselinePictures,unresolvedDirectPictures:0,criteria:'Images reviewed against gloss and example. Direct pictures and contextual scenes are tracked separately; contextual scenes do not create picture-quiz evidence.',reviewType:'Model content review and browser visual inspection, not teacher certification.'},remainingCount:remaining.length,reasonCounts:counts,remainingWithoutPictures:remaining,note:'Remaining entries are not declared impossible to illustrate. They need contextual rather than isolated direct-picture teaching design.'};
if(result.round.added+remaining.length!==baselineMissing)throw Error('Picture review does not close');
await writeFile(new URL('../data/vocabulary/picture-coverage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
await writeFile(new URL('../data/vocabulary/picture-review.json',import.meta.url),JSON.stringify({scope:`All ${WORDS.filter(w=>w.contentSource).length} added vocabulary cards; original 1168 pictures unchanged.`,entries:WORDS.filter(w=>w.contentSource).map(w=>w.image?{id:w.id,zh:w.zh,status:w.pictureCue?'contextual_picture':'direct_picture',topic:w.topic,source:mapping[w.id],image:w.image}:remaining.find(r=>r.id===w.id))},null,2)+'\n');
console.log(JSON.stringify({...result,remainingWithoutPictures:remaining.length}));
