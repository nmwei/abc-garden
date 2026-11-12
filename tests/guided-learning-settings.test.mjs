import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidedLearningSettings,GUIDED_SETTINGS_KEY} from '../web/app/guided-learning-settings.js';
import {createGuidedPolicy,readGuidedPolicy} from '../web/app/guided-learning-policy.js';
const fixture=()=>{let raw=null,fail=false;const storage=()=>({getItem:()=>raw,setItem:(_key,value)=>{if(fail)throw Error('quota');raw=value;}});return {storage,raw:()=>raw,write:value=>raw=value,fail:()=>fail=true};};
test('parent settings expose two bounded preferences and leave all learning evidence rules unchanged',()=>{
 const store=fixture(),settings=new GuidedLearningSettings(store);
 assert.match(GUIDED_SETTINGS_KEY,/guided-settings/);
 assert.deepEqual(readGuidedPolicy(settings.policy()),createGuidedPolicy());
 assert.equal(settings.save('newWordsPerGroup',6),true);assert.equal(settings.save('breakAfterMinutes',20),true);
 const loaded=new GuidedLearningSettings(store),policy=readGuidedPolicy(loaded.policy());
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
  assert.deepEqual(readGuidedPolicy(settings.policy()),createGuidedPolicy());assert.equal(settings.save('newWordsPerGroup',6),false);assert.equal(store.raw(),raw);
 }
});
test('unsupported old one-word preferences are not silently rewritten',()=>{
 const store=fixture(),raw=JSON.stringify({version:1,newWordsPerGroup:1,breakAfterMinutes:10});store.write(raw);
 const settings=new GuidedLearningSettings(store);
 assert.match(settings.status,/暂时无法读取/);assert.equal(settings.save('newWordsPerGroup',2),false);assert.equal(store.raw(),raw);
});

test('parent preferences overlay either preset without copying or weakening evidence settings',()=>{
 const store=fixture(),settings=new GuidedLearningSettings(store);
 settings.save('newWordsPerGroup',4);settings.save('breakAfterMinutes',10);
 const learn=settings.policy('learn'),review=settings.policy('review');
 assert.equal(learn.teaching.unfamiliarStart,'teach');
 assert.equal(review.teaching.unfamiliarStart,'recall');
 assert.equal(review.teaching.newWordsPerGroup,4);assert.equal(review.session.breakAfterMinutes,10);
 assert.deepEqual(learn.retrieval,review.retrieval);assert.deepEqual(learn.review,review.review);
});
