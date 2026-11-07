import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FollowAlong} from '../app/follow-along.js';

test('only looping repeats each name and sound; skipping and restarting reset the repeat counter',t=>{
 const oldAudio=globalThis.Audio,oldDocument=globalThis.document;
 globalThis.Audio=class {
  constructor(){this.calls=[];}
  setAttribute(){} removeAttribute(){this.src='';} load(){} pause(){}
  play(){this.calls.push(this.src);return Promise.resolve();}
 };
 globalThis.document={body:{append(){}}};
 t.after(()=>{if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;});
 for(const repeats of [1,2,3]){
  const follow=new FollowAlong(()=>'edcreate',()=>{});follow.start(['E','F'],{loop:true,repeats});
  for(let i=0;i<repeats*2;i++)follow.audio.onended();
  assert.deepEqual(follow.audio.calls,[...Array(repeats).fill('./assets/audio/name-E.wav'),...Array(repeats).fill('./assets/audio/sound-E.wav'),'./assets/audio/name-F.wav']);
  assert.equal(follow.repeatIndex,0);follow.stop();
 }
 const follow=new FollowAlong(()=>'edcreate',()=>{});follow.start(['E'],{repeats:3});
 follow.audio.onended();follow.audio.onended();assert.equal(follow.status,'done');assert.equal(follow.audio.calls.length,2);
 follow.start(['E','F'],{loop:true,repeats:3});follow.audio.onended();assert.equal(follow.repeatIndex,1);
 follow.skip(1);assert.equal(follow.repeatIndex,0);assert.equal(follow.index,1);assert.equal(follow.phase,'name');
 follow.stop();follow.start(['E','F'],{loop:true,repeats:9});assert.equal(follow.repeats,1);assert.equal(follow.repeatIndex,0);
 const changing=new FollowAlong(()=>'edcreate',()=>{});changing.start(['E','F'],{loop:true,repeats:3});changing.setRepeats(2);
 assert.equal(changing.repeats,3);assert.equal(changing.nextRepeats,2);
 for(let i=0;i<6;i++)changing.audio.onended();
 assert.equal(changing.index,1);assert.equal(changing.repeats,2);
 assert.deepEqual(changing.audio.calls,[...Array(3).fill('./assets/audio/name-E.wav'),...Array(3).fill('./assets/audio/sound-E.wav'),'./assets/audio/name-F.wav']);
 changing.setRepeats(1);changing.skip(-1);assert.equal(changing.repeats,1);assert.equal(changing.repeatIndex,0);

});
