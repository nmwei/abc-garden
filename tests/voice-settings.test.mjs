import test from 'node:test';import assert from 'node:assert/strict';import {pickVoice,voiceId} from '../app/voice-settings.js';
test('Chinese preference never overrides English; missing voice falls back deterministically',()=>{
 const a={name:'A',lang:'zh-CN',voiceURI:'a'},b={name:'B',lang:'zh-CN',voiceURI:'b',default:true},en={name:'English',lang:'en-US',voiceURI:'en'};
 assert.equal(pickVoice([a,b,en],'zh-CN',voiceId(a)),a);assert.equal(pickVoice([a,b,en],'en-US',voiceId(a)),en);assert.equal(pickVoice([a,b],'zh-CN','missing'),b);assert.equal(pickVoice([],'zh-CN',''),undefined);
});
