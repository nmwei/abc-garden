import test from 'node:test';import assert from 'node:assert/strict';import {pickVoice,voiceId,chineseVoices} from '../app/voice-settings.js';
test('Chinese preference never overrides English; missing voice falls back deterministically',()=>{
 const a={name:'A',lang:'zh-CN',voiceURI:'a'},b={name:'B',lang:'zh-CN',voiceURI:'b',default:true},en={name:'English',lang:'en-US',voiceURI:'en'};
 assert.equal(pickVoice([a,b,en],'zh-CN',voiceId(a)),a);assert.equal(pickVoice([a,b,en],'en-US',voiceId(a)),en);assert.equal(pickVoice([a,b],'zh-CN','missing'),b);assert.equal(pickVoice([],'zh-CN',''),undefined);
});
test('Chinese choices and playback exclude rejected voices without restricting new devices or English',t=>{
 const excluded=['Eddy','Flo','Grandma','Grandpa','Reed','Rocko','Sandy','Shelley'].flatMap(name=>['zh-CN','zh-TW'].map(lang=>({name:`${name} (中文)`,lang,voiceURI:`${name}-${lang}`,default:true})));
 const localized={name:'本地化名称',lang:'zh-CN',voiceURI:'com.apple.eloquence.zh-CN.Eddy'};
 const tw={name:'美嘉',lang:'zh-TW',voiceURI:'tw'},cn={name:'婷婷',lang:'zh-CN',voiceURI:'cn'},unknown={name:'新设备声音',lang:'cmn_CN',voiceURI:'new'};
 const en={name:'Eddy',lang:'en-US',voiceURI:'en'},hk={name:'粤语',lang:'zh-HK',voiceURI:'hk'};
 const voices=[...excluded,localized,tw,cn,unknown,en,hk];
 const previous=Object.getOwnPropertyDescriptor(globalThis,'speechSynthesis');
 Object.defineProperty(globalThis,'speechSynthesis',{configurable:true,value:{getVoices:()=>voices}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'speechSynthesis',previous);else delete globalThis.speechSynthesis;});
 assert.deepEqual(chineseVoices(),[tw,cn,unknown]);
 assert.equal(pickVoice(voices,'zh-CN',''),cn);
 assert.equal(pickVoice(voices,'zh-CN',voiceId(excluded[0])),cn);
 assert.equal(pickVoice(voices,'zh-CN',voiceId(tw)),tw);
 assert.equal(pickVoice([unknown],'zh-CN',''),unknown);
 assert.equal(pickVoice(voices,'en-US',voiceId(cn)),en);
 assert.equal(pickVoice(excluded,'zh-CN',''),undefined);
});
