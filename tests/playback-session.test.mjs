import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GardenAudio} from '../app/audio.js';
import {acquirePlaybackSession} from '../app/playback-session.js';
function setup(t){
 const original={Audio:globalThis.Audio,document:globalThis.document,speechSynthesis:globalThis.speechSynthesis,SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 const events=[];let type='auto',ducked=false,utterance;
 const session={get type(){return type;},set type(value){events.push(`session:${value}`);type=value;}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:session}});
 globalThis.document={body:{append(){}}};
 globalThis.Audio=class{setAttribute(){}removeAttribute(){this.src='';}load(){}pause(){}play(){events.push(`recording:${ducked?'ducked':'normal'}:${type}`);return Promise.resolve();}};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;this.volume=1;}};
 globalThis.speechSynthesis={getVoices:()=>[],speak:u=>{events.push(u.volume===0?'primer':'speech');utterance=u;ducked=true;},cancel:()=>{events.push('cancel');ducked=false;}};
 t.after(()=>{for(const key of ['Audio','document','speechSynthesis','SpeechSynthesisUtterance'])if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;});
 return {events,session,endSpeech:()=>utterance.onend(),get utterance(){return utterance;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('repeated English/Chinese taps and a loop release native speech before the next recorded word',async t=>{
 const env=setup(t),audio=new GardenAudio(()=>({}));
 for(let i=0;i<2;i++){
  audio.unlockSpeech();const pending=audio.play([{src:'word.wav'},{text:'苹果'}]);audio.element.onended();await tick();
  assert.equal(env.session.type,'playback');env.endSpeech();assert.equal(await pending,true);assert.equal(env.session.type,'auto');
 }
 const pending=audio.play([{src:'apple.wav'},{text:'苹果'},{src:'cat.wav'},{text:'猫'}]);
 audio.element.onended();await tick();env.endSpeech();await tick();audio.element.onended();await tick();env.endSpeech();assert.equal(await pending,true);
 assert.equal(env.events.filter(e=>e==='primer').length,1);
 assert.deepEqual(env.events.filter(e=>e.startsWith('recording:')),Array(4).fill('recording:normal:playback'));
 assert.equal(env.events.at(-2),'cancel');assert.equal(env.events.at(-1),'session:auto');
});
test('overlapping players release idempotently and never restore a session owned by another player',t=>{
 const {session}=setup(t);const letter=acquirePlaybackSession(),word=acquirePlaybackSession();
 letter();letter();assert.equal(session.type,'playback');word();assert.equal(session.type,'auto');
 const release=acquirePlaybackSession();session.type='play-and-record';release();assert.equal(session.type,'play-and-record');
});
test('cancelled speech cannot release the replacement sequence through a stale callback',async t=>{
 const env=setup(t),audio=new GardenAudio(()=>({}));
 const first=audio.play([{text:'苹果'}]);const stale=env.utterance.onend;
 const second=audio.play([{src:'cat.wav'}]);stale();await tick();assert.equal(await first,false);assert.equal(env.session.type,'playback');
 audio.element.onended();assert.equal(await second,true);assert.equal(env.session.type,'auto');
});
test('unsupported audio session API leaves ordinary playback and cancellation usable',async t=>{
 setup(t);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
 const audio=new GardenAudio(()=>({})),pending=audio.play([{src:'word.wav'}]);audio.stop();assert.equal(await pending,false);
});
