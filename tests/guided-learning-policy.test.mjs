import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedPolicy,readGuidedPolicy,DEFAULT_GUIDED_POLICY} from '../app/guided-learning-policy.js';

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
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,version:3}),null);
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,id:'spelling'}),null);
 assert.equal(readGuidedPolicy({...DEFAULT_GUIDED_POLICY,unexpected:1}),null);
});
