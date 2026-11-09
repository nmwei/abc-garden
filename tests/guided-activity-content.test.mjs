import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {READY_WORDS,CATALOG_BY_ID} from '../app/course-content.js';
import {sentenceMeaning} from '../app/sentence-meanings.js';
import {ACTIVITY_PROFILES} from '../app/guided-activity-profiles.js';
import {GUIDED_WORD_PLANS,GUIDED_PLAN_FINGERPRINT} from '../app/guided-word-plans.js';
import {activityFor} from '../app/guided-activities.js';
import {GuidedWords} from '../app/guided-words.js';
import {startRound,markHeard,nextTeachingStep} from '../app/guided-words-core.js';
import {GUIDED_KEY,freshGuided} from '../app/guided-progress.js';
import {validateGuidedPlans} from '../scripts/guided-activity-validation.mjs';
const registry=JSON.parse(await readFile(new URL('../data/vocabulary/guided-word-plans.json',import.meta.url),'utf8'));
const scenes=JSON.parse(await readFile(new URL('../data/vocabulary/guided-scenes.json',import.meta.url),'utf8')).entries;
const validate=(document=registry,examples=scenes)=>validateGuidedPlans(READY_WORDS,document,examples,ACTIVITY_PROFILES,sentenceMeaning);
test('the explicit registry covers the entire catalog and structural errors require content review',()=>{
 assert.deepEqual(validate(),GUIDED_WORD_PLANS);
 const missing=structuredClone(registry),removed=missing.entries.find(entry=>!scenes[entry.id]).id;
 missing.entries=missing.entries.filter(entry=>entry.id!==removed);
 assert.throws(()=>validate(missing),new RegExp('Missing: '+removed));
 const stale=structuredClone(registry);stale.entries[0].snapshot.sentence='Changed without review.';
 assert.throws(()=>validate(stale),/changed meanings\/examples/);
 const badProfile=structuredClone(registry);badProfile.entries[0].profile='unreviewed-topic';
 assert.throws(()=>validate(badProfile),/Invalid guided activity plan/);
 const duplicate=structuredClone(registry);duplicate.entries.push(duplicate.entries[0]);
 assert.throws(()=>validate(duplicate),/Invalid guided activity plan/);
 assert.throws(()=>validate(registry,{...scenes,unknown:{scene:'孤立场景'}}),/Orphan guided scene/);
});
test('lesson strategies follow the selected meaning, not the spelling or library topic',()=>{
 const cases={hand:'body',a:'language',an:'language',can:'language',spring:'time',fall:'time',fly:'animal',wave:'nature',drink:'food',brush:'object',
  match:'photo-tool',patient:'social-quality',anxious:'emotion',observe:'action-scene','observe-watch':'motor',state:'geography',capital:'geography',
  material:'written-content',energy:'emotion',virus:'digital',natural:'quality-scene',top:'toy',always:'frequency',once:'quantity',
  blind:'accessibility',deaf:'accessibility',sleeve:'clothing-part',tail:'animal-part'};
 for(const [id,profile] of Object.entries(cases))assert.equal(activityFor(CATALOG_BY_ID.get(id)).profile,profile,id);
 assert.match(activityFor(CATALOG_BY_ID.get('match')).setup,/只准备/);
 assert.match(activityFor(CATALOG_BY_ID.get('left')).setup,/以孩子的左右为准/);
 assert.match(activityFor(CATALOG_BY_ID.get('patient')).scene,/轮流|等待/);
 assert.doesNotMatch(activityFor(CATALOG_BY_ID.get('observe')).scene,/蝴蝶/);
 assert.match(activityFor(CATALOG_BY_ID.get('observe-watch')).scene,/蝴蝶/);
 // Moving a card between browsing topics cannot silently change its lesson.
 for(const [id,topic] of [['jump','animals'],['fly','actions']]){
  const word=CATALOG_BY_ID.get(id),before=activityFor(word),originalTopic=word.topic;
  try{word.topic=topic;assert.deepEqual(activityFor(word),before,id);}
  finally{word.topic=originalTopic;}
 }
});
test('functional language and non-object concepts cannot become direct-image identification questions',()=>{
 for(const word of READY_WORDS){
  const activity=activityFor(word);
  if(['限定词','代词','助动词','情态动词','连词'].includes(word.pos)){
   assert.equal(activity.contextual,true,word.id);assert.equal(activity.pictureChoice,false,word.id);
  }
  if(activity.pictureChoice){assert.equal(word.pictureCue,false,word.id);assert.ok(!word.pos||word.pos==='名词',word.id);}
 }
 for(const id of ['because','already','my','time','price','government','cancer','radium'])assert.equal(activityFor(CATALOG_BY_ID.get(id)).pictureChoice,false,id);
});
test('word recordings stay intact, context adds a short model, and recognition hears the phrase',()=>{
 const guided=new GuidedWords({getWords:()=>[],wordClip:word=>({src:word.audio+'.wav'}),sentenceClip:word=>({src:'sentence-'+word.id+'.wav'})});
 const word=CATALOG_BY_ID.get('a'),activity=activityFor(word);
 const items=guided.modelItems(word,activity,'learn');
 assert.equal(items[0].src,word.audio+'.wav');assert.equal(items[1].text,'I have a ball.');assert.equal(items[1].lang,'en-US');
 assert.deepEqual(guided.modelItems(word,activity,'understand'),[items[1]]);
 const apple=CATALOG_BY_ID.get('apple');assert.deepEqual(guided.modelItems(apple,activityFor(apple),'learn'),[{src:apple.audio+'.wav'}]);
 const edited={...word,zh:'家长自定的另一个意思'},custom=activityFor(edited);
 assert.equal(custom.source,'custom');assert.equal(custom.modelText,'');assert.equal(guided.modelItems(edited,custom,'learn').length,1);
});
test('context respects edited examples and keeps attribution on reused source examples',()=>{
 const source=READY_WORDS.find(word=>word.sentenceCredit&&activityFor(word).contextual&&!GUIDED_WORD_PLANS[word.id].modelText);
 assert.ok(source);assert.equal(activityFor(source).modelCredit,source.sentenceCredit);
 const original=CATALOG_BY_ID.get('a'),edited={...original,sentence:'I have a kite.',sentenceZh:'我有一只风筝。'};
 const result=activityFor(edited);assert.equal(result.modelText,edited.sentence);assert.equal(result.scene,edited.sentenceZh);assert.equal(result.modelCredit,'');
});
test('old unsuitable picture choices are converted on resume, preserving hint exposure and history',t=>{
 const data=freshGuided(),now=Date.now(),ids=['big','ball'];startRound(data,ids,now,ids);
 for(let i=0;i<2;i++){markHeard(data,now);nextTeachingStep(data,now);}
 assert.equal(data.session.queue[0].kind,'choose');data.session.queue[0].heard=true;
 const future=data.session.queue.find(current=>current.kind==='recall'&&current.id==='big');future.prompted=true;
 let raw=JSON.stringify(data);const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,GUIDED_KEY);raw=value;}}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 const guided=new GuidedWords({getWords:()=>ids.map(id=>CATALOG_BY_ID.get(id)),getActivity:activityFor,contentVersion:GUIDED_PLAN_FINGERPRINT});
 assert.equal(guided.syncContent(),true);assert.equal(guided.data.session.queue[0].kind,'understand');assert.equal(guided.data.session.queue[0].heard,false);
 assert.equal(guided.data.session.queue.find(current=>current.kind==='recall'&&current.id==='big').prompted,true);
 assert.deepEqual(guided.data.entries.big.days,[]);
});
