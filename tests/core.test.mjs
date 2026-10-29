import {test} from 'node:test';
import assert from 'node:assert/strict';
import { freshState,createSession,recordTask,sanitizeState,selectTargets,summarize,completeSession } from '../app/core.js';
import { LETTERS,BLENDS } from '../app/content.js';

test('a full alphabet never becomes a 26-letter daily drill',()=>{
  const state=freshState();state.settings.letters=[...LETTERS];
  const session=createSession(state,100000,()=>.3);
  assert.equal(session.queue.length,8);assert.equal(session.letters.length,2);
  assert.ok(session.queue.every(t=>session.letters.includes(t.letter)));
});
test('matching and listening use two distinct letters; name questions never contrast uppercase against lowercase of the same letter',()=>{
  const state=freshState();
  for(let seed=0;seed<20;seed++){
    const session=createSession(state,seed,()=>seed/21);
    for(const task of session.queue.filter(t=>t.options)){
      assert.equal(new Set(task.options).size,2);assert.ok(task.options.includes(task.letter));
      assert.ok(task.options.every(l=>state.settings.letters.includes(l)));
    }
  }
});
test('one old due item and one new item can coexist without repeating only the newest lesson',()=>{
  const state=freshState(),now=4*86400000;
  state.events.push({id:'old',letter:'A',case:'lower',skill:'name',correct:false,assisted:true,at:86400000});
  assert.deepEqual(selectTargets(state,now),['A','B']);
});
test('help and recall participation never manufacture independent reading evidence',()=>{
  const state=freshState();state.session=createSession(state,1000,()=>.2);
  state.session.index=2;recordTask(state,{correct:false,assisted:true});
  state.session.index=6;recordTask(state,{correct:null,assisted:false});
  assert.equal(summarize(state.events,'A','name','lower').independent,0);
  assert.equal(summarize(state.events,'A','recallName','lower').independent,0);
  assert.deepEqual(state.observations,{});
});
test('recording the same task again is idempotent after reload',()=>{
  const state=freshState();state.session=createSession(state,1000,()=>.2);state.session.index=2;
  state.session.task={assisted:false,done:true,selected:'A',feedback:'找到啦'};recordTask(state,{correct:true});
  const restored=sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.session.index,2);recordTask(restored,{correct:true});assert.equal(restored.events.length,1);
});
test('sound and blending require parent confirmation; blends only use selected letters',()=>{
  const state=freshState();state.settings.mode='sound';state.settings.blending=true;
  assert.equal(createSession(state).mode,'name');assert.ok(createSession(state).queue.every(t=>t.kind!=='blend'));
  state.settings.soundConfirmed=true;
  const session=createSession(state,100,()=>.2);const blend=session.queue.find(t=>t.kind==='blend');
  assert.ok(blend);assert.ok(BLENDS.find(b=>b.id===blend.blendId).letters.every(l=>state.settings.letters.includes(l)));
});
test('ending early reports only letters actually practiced and never marks the round complete',()=>{
  const state=freshState();state.session=createSession(state,1000,()=>.2);recordTask(state);
  const result=completeSession(state,false,2000);assert.deepEqual(result.letters,['A']);assert.equal(result.completed,false);assert.equal(state.session,null);
});
test('malformed backups cannot inject out-of-scope questions or fake observations',()=>{
  const state=freshState();state.settings.letters=['A'];state.settings.mode='sound';state.settings.minutes=-1;
  state.observations={'A:lower:recallName':{value:'mastered',at:1},'Z:lower:recallSound':{value:'independent',at:1}};
  state.events=[{id:'x',letter:'<script>',case:'lower',skill:'name',correct:true,assisted:false,at:1}];
  state.session=createSession(freshState(),1000,()=>.2);state.session.queue[1].options=['A','A'];
  const clean=sanitizeState(state);assert.equal(clean.settings.minutes,5);assert.equal(clean.settings.mode,'name');assert.ok(clean.settings.letters.length>=2);assert.equal(clean.events.length,0);assert.equal(clean.session,null);assert.equal(Object.keys(clean.observations).length,1);
});
