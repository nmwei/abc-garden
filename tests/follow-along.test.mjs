import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FollowAlong} from '../web/app/follow-along.js';
import {readPcmWav,makeLetterLoop} from '../web/app/letter-loop-audio.js';

const file=async path=>{const bytes=await readFile(new URL(`../web/${path}`,import.meta.url));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);};
function environment(t){
 const originals={Audio:globalThis.Audio,document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 globalThis.Audio=class {
  constructor(){this.calls=[];this.currentTime=0;this.paused=true;}
  set src(value){this.source=value;this.currentTime=0;}get src(){return this.source;}
  setAttribute(){}removeAttribute(){this.source='';}load(){}pause(){this.paused=true;}
  play(){this.calls.push(this.src);this.paused=false;return Promise.resolve();}
 };
 globalThis.document={hidden:false,body:{append(){}}};
 const handlers={},mediaSession={setActionHandler:(action,handler)=>{handlers[action]=handler;}},audioSession={type:'auto'};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaSession,audioSession}});
 const blobs=new Map(),revoked=[];
 t.mock.method(URL,'createObjectURL',blob=>{const url=`blob:round-${blobs.size}`;blobs.set(url,blob);return url;});
 t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url));
 t.mock.method(globalThis,'fetch',async(path,{signal}={})=>{signal?.throwIfAborted();return new Response(await file(path));});
 t.after(()=>{for(const key of ['Audio','document'])if(originals[key]===undefined)delete globalThis[key];else globalThis[key]=originals[key];if(originals.navigator)Object.defineProperty(globalThis,'navigator',originals.navigator);else delete globalThis.navigator;});
 return {blobs,revoked,handlers,mediaSession,audioSession};
}

test('both complete sources preserve every original PCM sample in all three repeat counts',async()=>{
 for(const source of ['','gk/']){
  const clips=await Promise.all([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].flatMap((letter,index)=>['name','sound'].map(async phase=>({index,phase,...readPcmWav(await file(`assets/audio/${source}${phase}-${letter}.wav`))}))));
  for(const repeats of [1,2,3]){
   const round=makeLetterLoop(clips,repeats),result=readPcmWav(await round.blob.arrayBuffer());
   const expected=Buffer.concat(clips.flatMap(clip=>Array(repeats).fill(Buffer.from(clip.data))));
   assert.deepEqual(Buffer.from(result.data),expected);
   assert.equal(result.duration,round.duration);assert.equal(round.segments.length,52*repeats);
   assert.deepEqual(round.segments.filter(s=>s.index===0).map(s=>[s.phase,s.repeatIndex]),['name','sound'].flatMap(phase=>Array.from({length:repeats},(_,i)=>[phase,i])));
  }
 }
});

test('WAV reader accepts padded metadata and rejects truncated, non-PCM and mixed formats',async()=>{
 const original=Buffer.from(await file('assets/audio/name-E.wav'));
 const junk=Buffer.from([74,85,78,75,1,0,0,0,42,0]);
 const padded=Buffer.concat([original.subarray(0,12),junk,original.subarray(12)]);padded.writeUInt32LE(padded.length-8,4);
 assert.deepEqual(Buffer.from(readPcmWav(padded.buffer.slice(padded.byteOffset,padded.byteOffset+padded.length)).data),Buffer.from(readPcmWav(await file('assets/audio/name-E.wav')).data));
 assert.throws(()=>readPcmWav(new ArrayBuffer(4)));
 assert.throws(()=>readPcmWav(original.buffer.slice(original.byteOffset,original.byteOffset+original.length-1)));
 const invalid=await file('assets/audio/name-E.wav');new DataView(invalid).setUint16(20,3,true);assert.throws(()=>readPcmWav(invalid),/PCM/);
 const pcm=readPcmWav(await file('assets/audio/name-E.wav'));
 assert.throws(()=>makeLetterLoop([pcm,{...pcm,format:{...pcm.format,sampleRate:48000}}],1),/Incompatible/);
});

test('one native loop keeps the same source and play call through progress, wraps and visibility changes',async t=>{
 const {revoked,handlers,mediaSession,audioSession}=environment(t);
 const follow=new FollowAlong(()=>'gk',()=>{});await follow.prepareLoop(['E','F']);follow.start(['E','F'],{loop:true,repeats:2});
 const source=follow.audio.src;assert.equal(follow.audio.loop,true);assert.equal(follow.audio.calls.length,1);assert.equal(audioSession.type,'playback');
 for(const segment of [...follow.track.segments,...follow.track.segments]){follow.audio.currentTime=segment.start+.001;follow.audio.ontimeupdate();assert.equal(follow.index,segment.index);assert.equal(follow.phase,segment.phase);assert.equal(follow.repeatIndex,segment.repeatIndex);}
 document.hidden=true;follow.visibilityChanged();assert.equal(follow.status,'playing');assert.equal(follow.audio.paused,false);
 handlers.pause();follow.audio.onplay();assert.equal(follow.status,'paused');follow.visibilityChanged();assert.equal(follow.audio.src,source);
 handlers.play();assert.equal(follow.status,'playing');assert.equal(mediaSession.playbackState,'playing');
 assert.equal(follow.audio.calls.length,2);assert.equal(follow.audio.src,source);
 document.hidden=false;follow.visibilityChanged();handlers.stop();
 assert.equal(follow.audio.src,'');assert.equal(follow.audio.loop,false);assert.deepEqual(revoked,[source]);assert.equal(audioSession.type,'auto');assert.equal(handlers.play,null);assert.equal(mediaSession.playbackState,'none');
});

test('repeat changes finish the current letter, then switch once to the new native round',async t=>{
 const {revoked}=environment(t);const follow=new FollowAlong(()=>'edcreate',()=>{});
 await follow.prepareLoop(['E','F']);follow.start(['E','F'],{loop:true,repeats:2});const old=follow.audio.src;
 follow.audio.currentTime=follow.track.segments[1].start+.01;follow.syncLoop();follow.setRepeats(3);
 assert.equal(follow.repeats,2);assert.equal(follow.audio.src,old);
 follow.audio.currentTime=follow.track.segments[3].start+.01;follow.syncLoop();assert.equal(follow.repeats,2);
 follow.audio.currentTime=follow.track.segments[4].start+.01;follow.syncLoop();
 assert.equal(follow.repeats,3);assert.equal(follow.index,1);assert.equal(follow.repeatIndex,0);assert.equal(follow.phase,'name');assert.equal(follow.audio.calls.length,2);assert.deepEqual(revoked,[old]);
 follow.setRepeats(1);follow.skip(-1);assert.equal(follow.repeats,1);assert.equal(follow.index,0);assert.equal(follow.repeatIndex,0);follow.stop();
});

test('repeat changes also apply when crossing the native round boundary',async t=>{
 environment(t);const follow=new FollowAlong(()=>'edcreate',()=>{});await follow.prepareLoop(['E','F']);follow.start(['E','F'],{loop:true});
 follow.audio.currentTime=follow.track.segments.at(-1).start+.01;follow.syncLoop();follow.setRepeats(3);
 follow.audio.currentTime=.01;follow.syncLoop();assert.equal(follow.repeats,3);assert.equal(follow.index,0);follow.stop();
});

test('a paused loop can apply new repeats without starting playback, including a single-letter round',async t=>{
 environment(t);const follow=new FollowAlong(()=>'edcreate',()=>{});await follow.prepareLoop(['E']);follow.start(['E'],{loop:true});
 follow.pause();follow.setRepeats(3);const plays=follow.audio.calls.length;
 follow.audio.currentTime=follow.track.duration-.01;follow.syncLoop();follow.audio.currentTime=0;follow.syncLoop();
 assert.equal(follow.repeats,3);assert.equal(follow.status,'paused');assert.equal(follow.audio.paused,true);assert.equal(follow.audio.calls.length,plays);follow.stop();
});

test('single-letter taps remain single, stop on hiding and cannot be revived by stale play failures',async t=>{
 environment(t);const follow=new FollowAlong(()=>'edcreate',()=>{});follow.start(['E'],{repeats:3});
 follow.audio.onended();follow.audio.onended();assert.equal(follow.status,'done');assert.equal(follow.audio.loop,false);assert.equal(follow.audio.calls.length,2);
 let reject;follow.audio.play=()=>new Promise((_,no)=>{reject=no;});follow.start(['F']);
 document.hidden=true;follow.visibilityChanged();reject(Error('old play'));await Promise.resolve();assert.equal(follow.status,'idle');assert.equal(follow.audio.src,'');
});

test('preparing never autoplays, ignores stale source loads and retries failed fetches',async t=>{
 environment(t);let source='edcreate';const gates=[],fetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(path,options)=>{if(path.includes('gk/'))return fetch(path,options);await new Promise(resolve=>gates.push(resolve));return fetch(path);});
 const follow=new FollowAlong(()=>source,()=>{});const old=follow.prepareLoop(['E']);follow.stop();
 source='gk';await follow.prepareLoop(['F']);assert.equal(follow.preparation.status,'ready');assert.equal(follow.audio.calls.length,0);
 gates.forEach(resolve=>resolve());await old;assert.equal(follow.preparation.key,'gk:F');
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:404}));
 await follow.prepareLoop(['F'],true);assert.equal(follow.preparation.status,'error');assert.equal(follow.audio.calls.length,0);
 t.mock.method(globalThis,'fetch',fetch);await follow.prepareLoop(['F'],true);assert.equal(follow.preparation.status,'ready');follow.stop();
});

test('loop playback failure releases its Blob and lock-screen ownership',async t=>{
 const {revoked,handlers,audioSession}=environment(t);const follow=new FollowAlong(()=>'edcreate',()=>{});await follow.prepareLoop(['E','F']);
 follow.audio.play=()=>Promise.reject(Error('blocked'));follow.start(['E','F'],{loop:true});await Promise.resolve();
 assert.equal(follow.status,'error');assert.equal(follow.audio.src,'');assert.equal(revoked.length,1);assert.equal(handlers.pause,null);assert.equal(audioSession.type,'auto');
});
