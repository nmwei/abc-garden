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
