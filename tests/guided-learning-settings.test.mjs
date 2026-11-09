import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidedLearningSettings,GUIDED_SETTINGS_KEY} from '../app/guided-learning-settings.js';
import {createGuidedPolicy} from '../app/guided-learning-policy.js';
const fixture=()=>{let raw=null,fail=false;const storage=()=>({getItem:()=>raw,setItem:(_key,value)=>{if(fail)throw Error('quota');raw=value;}});return {storage,raw:()=>raw,write:value=>raw=value,fail:()=>fail=true};};
test('parent settings expose two bounded preferences and leave all learning evidence rules unchanged',()=>{
 const store=fixture(),settings=new GuidedLearningSettings(store);
 assert.match(GUIDED_SETTINGS_KEY,/guided-settings/);
 assert.deepEqual(createGuidedPolicy(settings.policy()),createGuidedPolicy());
 assert.equal(settings.save('newWordsPerGroup',6),true);assert.equal(settings.save('breakAfterMinutes',20),true);
 const loaded=new GuidedLearningSettings(store),policy=createGuidedPolicy(loaded.policy());
 assert.equal(policy.teaching.newWordsPerGroup,6);assert.equal(policy.session.breakAfterMinutes,20);
 assert.deepEqual(policy.retrieval,createGuidedPolicy().retrieval);assert.deepEqual(policy.review,createGuidedPolicy().review);
 const before=store.raw();assert.equal(settings.save('newWordsPerGroup',1),false);assert.equal(settings.save('breakAfterMinutes',30),false);assert.equal(settings.save('newWordSuccesses',1),false);assert.equal(settings.save('__proto__',1),false);assert.equal(store.raw(),before);
});
test('preferences are reread across instances, while failed writes retain the actual saved choices',()=>{
 const store=fixture(),a=new GuidedLearningSettings(store),b=new GuidedLearningSettings(store);
 a.save('newWordsPerGroup',6);b.save('breakAfterMinutes',10);
 assert.equal(a.policy().session.breakAfterMinutes,10);assert.equal(b.policy().teaching.newWordsPerGroup,6);
 store.fail();assert.equal(a.save('breakAfterMinutes',20),false);assert.equal(a.values.breakAfterMinutes,10);assert.match(a.status,/保存失败/);
});
test('unreadable or future preference data remains untouched and the valid default path is available',()=>{
 for(const raw of ['invalid','null','{"version":2}','{"version":1,"newWordsPerGroup":9,"breakAfterMinutes":15}']){
  const store=fixture();store.write(raw);const settings=new GuidedLearningSettings(store);
  assert.deepEqual(createGuidedPolicy(settings.policy()),createGuidedPolicy());assert.equal(settings.save('newWordsPerGroup',6),false);assert.equal(store.raw(),raw);
 }
});
test('old one-word preferences become two for future plans without rewriting the saved preference',()=>{
 const store=fixture(),raw=JSON.stringify({version:1,newWordsPerGroup:1,breakAfterMinutes:10});store.write(raw);
 const settings=new GuidedLearningSettings(store);
 assert.equal(settings.policy().teaching.newWordsPerGroup,2);assert.equal(settings.policy().session.breakAfterMinutes,10);assert.equal(store.raw(),raw);
 for(const count of [2,3,4,5,6]){assert.equal(settings.save('newWordsPerGroup',count),true);assert.equal(settings.policy().teaching.newWordsPerGroup,count);}
 assert.equal(settings.save('newWordsPerGroup',7),false);
});
