import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ListenGame} from '../app/listen-game.js';

const makeGame=()=>new ListenGame({audio:{stop(){},async play(){return true;}},refresh(){},letters:()=>['A','B']});
test('settings are a draft: cancel preserves the round and apply persists validated preferences',async t=>{
 const previous=globalThis.localStorage,store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 t.after(()=>{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;});
 const game=makeGame();t.after(()=>game.leave());game.start();await Promise.resolve();
 const round=game.round;round.queue=['A','B'];round.answer('B');
 game.settings();game.edit({dataset:{listenSetting:'mode'},type:'radio',value:'sound'});
 assert.equal(game.options.mode,'name');game.cancelSettings();await Promise.resolve();
 assert.equal(game.round,round);assert.deepEqual([...round.wrong],['B']);assert.equal(game.options.mode,'name');
 game.settings();game.edit({dataset:{listenSetting:'mode'},type:'radio',value:'sound'});
 game.edit({dataset:{listenSetting:'letterCase'},type:'radio',value:'lower'});
 game.start();await Promise.resolve();assert.notEqual(game.round,round);
 const restored=makeGame();assert.equal(restored.options.mode,'sound');assert.equal(restored.options.letterCase,'lower');restored.leave();
 store.set('abc-listen-game-options-v1',JSON.stringify({mode:'invalid',effects:'false',kind:'game'}));
 const invalid=makeGame();assert.equal(invalid.options.mode,'name');assert.equal(invalid.options.effects,true);assert.equal(invalid.options.kind,'game');invalid.leave();
});

test('answer feedback resumes and reuses a suspended audio context; mute and stale resumes produce no tone',async t=>{
 const previous=globalThis.AudioContext,contexts=[];
 class Context {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.tones=[];this.resumes=0;contexts.push(this);}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  createOscillator(){const tone={frequency:{setValueAtTime(v){tone.first=v;},exponentialRampToValueAtTime(v){tone.last=v;}},connect(){},disconnect(){},start(){tone.started=true;},stop(){}};this.tones.push(tone);return tone;}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 globalThis.AudioContext=Context;
 t.after(()=>{if(previous===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previous;});
 const game=makeGame();t.after(()=>game.leave());
 await game.effect(true);const ctx=contexts[0];assert.equal(ctx.resumes,1);assert.equal(ctx.tones[0].started,true);assert.ok(ctx.tones[0].last>ctx.tones[0].first);
 ctx.state='suspended';await game.effect(false);assert.equal(contexts.length,1);assert.equal(ctx.resumes,2);assert.ok(ctx.tones[1].last<ctx.tones[1].first);
 game.options.effects=false;await game.effect(true);assert.equal(ctx.tones.length,2);
 game.options.effects=true;ctx.state='suspended';let resolve;ctx.resume=()=>new Promise(r=>{resolve=()=>{ctx.state='running';r();};});
 const pending=game.effect(true);game.stopEffect();resolve();await pending;assert.equal(ctx.tones.length,2);
});
