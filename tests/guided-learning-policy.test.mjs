import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedPolicy,readGuidedPolicy,DEFAULT_GUIDED_POLICY,GUIDED_PRESETS,guidedInitialTask} from '../web/app/guided-learning-policy.js';

test('policy has a small set of coherent learning controls, and partial overrides cannot mutate defaults',()=>{
 const input={session:{breakAfterMinutes:12},review:{intervalsDays:[2,4,9]}},policy=createGuidedPolicy(input);
 input.review.intervalsDays[0]=8;
 assert.equal(policy.session.breakAfterMinutes,12);assert.equal(policy.session.maxWords,10);
 assert.deepEqual(policy.review.intervalsDays,[2,4,9]);assert.deepEqual(DEFAULT_GUIDED_POLICY.review.intervalsDays,[1,3,7]);
 assert.throws(()=>{policy.session.maxWords=4;},TypeError);
 assert.deepEqual(readGuidedPolicy(JSON.parse(JSON.stringify(policy))),policy);
});
test('invalid or contradictory policies fail at construction, rather than silently changing learning rules',()=>{
 for(const input of [
  {session:null},{session:{maxWords:0}},{session:{maxWords:11}},{session:{breakAfterMinutes:NaN}},
  {teaching:{newWordsPerGroup:7}},{teaching:{maxMeaningAttempts:0}},
  {retrieval:{newWordSuccesses:1}},{retrieval:{newWordSuccesses:3,maxAttempts:2}},
  {retrieval:{minInterveningActivities:3,preferredAfterSuccess:2}},
  {review:{intervalsDays:[1,1,7]}},{review:{intervalsDays:[1,3]}},{review:{retryAfterMinutes:0}},
  {session:{breakAfterMinute:12}},{allowPromptedMastery:true},{id:'another-goal'},
 ])assert.throws(()=>createGuidedPolicy(input),JSON.stringify(input));
});
test('saved policy snapshots must be complete and supported, independent of new defaults',()=>{
 const snapshot=JSON.parse(JSON.stringify(createGuidedPolicy({session:{maxWords:4}})));
 assert.equal(readGuidedPolicy(snapshot).session.maxWords,4);
 delete snapshot.review.retryAfterMinutes;assert.equal(readGuidedPolicy(snapshot),null);
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,version:4}),null);
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,id:'spelling'}),null);
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,unexpected:1}),null);
});


test('presets compose concrete rules; either preset accepts the same validated overrides',()=>{
 const learning={policySnapshot:createGuidedPolicy()},review={policySnapshot:createGuidedPolicy({},{preset:'review'})};
 assert.equal(guidedInitialTask(learning,null),'learn');
 assert.equal(guidedInitialTask(learning,{meaning:true}),'recall');
 assert.equal(guidedInitialTask(review,null),'recall');
 assert.equal(guidedInitialTask({...review,relearn:true},{meaning:true}),'learn');
 assert.deepEqual(learning.policySnapshot.retrieval,review.policySnapshot.retrieval);
 assert.deepEqual(learning.policySnapshot.review,review.policySnapshot.review);
 assert.deepEqual(createGuidedPolicy({teaching:{unfamiliarStart:'teach'}},{preset:'review'}),learning.policySnapshot);
 assert.deepEqual(createGuidedPolicy({teaching:{unfamiliarStart:'recall'}}),review.policySnapshot);
 assert.throws(()=>createGuidedPolicy({},{preset:'unsupported'}));
 assert.throws(()=>{GUIDED_PRESETS.review.teaching.unfamiliarStart='teach';},TypeError);
});
test('selection and entry rules validate strictly, including restored snapshots',()=>{
 for(const value of [
  {selection:{eligibility:'unseen'}},{selection:{priority:'random'}},{selection:null},
  {teaching:{unfamiliarStart:'review'}},{allowPromptedMastery:true},
 ])assert.throws(()=>createGuidedPolicy(value));
 for(const snapshot of [
  {...DEFAULT_GUIDED_POLICY,selection:undefined},
  {...DEFAULT_GUIDED_POLICY,teaching:{newWordsPerGroup:2,maxMeaningAttempts:2}},
  {...DEFAULT_GUIDED_POLICY,version:2,selection:null},
 ])assert.equal(readGuidedPolicy(snapshot),null);
 for(const version of [1,2]){
  const old=structuredClone(DEFAULT_GUIDED_POLICY);old.version=version;
  delete old.selection;delete old.teaching.unfamiliarStart;
  assert.equal(readGuidedPolicy(old),null);
  delete old.retrieval.maxAttempts;assert.equal(readGuidedPolicy(old),null);
 }
});
