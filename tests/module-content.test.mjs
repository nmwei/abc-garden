import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanWeekly,parseBlends,parseWords,blendSteps} from '../app/module-content.js';
test('weekly classroom content validates limits and preserves explicit sentences',()=>{
 assert.deepEqual(parseWords('mix | 搅拌 | I can mix. | 做搅拌动作'),[{word:'mix',zh:'搅拌',sentence:'I can mix.',action:'做搅拌动作'}]);
 assert.throws(()=>parseWords('<script> | x'));
 assert.throws(()=>parseBlends('abc123'));
 assert.equal(cleanWeekly({letters:'e, f G h',repeats:2}).letters,'EFGH');
 assert.deepEqual(blendSteps('deb'),['d','e','de','b','deb']);
 assert.deepEqual(blendSteps('cat'),['c','a','ca','t','cat']);
 assert.throws(()=>cleanWeekly({letters:''}));
});
test('word keys remain unique and unsupported sentence input fails before generation',()=>{assert.throws(()=>parseWords('mix | 搅拌\nMix | 混合'));assert.throws(()=>parseWords('mix | 搅拌 | 我会搅拌'));});

test('legacy storage keeps custom fields, audio and matching sentence translations',()=>{
 const raw={letters:'EFGH',words:'cat | 小猫 | My cat is cute. | 指一指',repeats:2,gap:500,selectedWordIds:['cat'],clips:{'word:cat':'data:audio/wav;base64,AAAA'},sentenceTranslations:{cat:{sentence:'My cat is cute.',zh:'我的猫很可爱。'}}};
 const result=cleanWeekly(raw);assert.equal(result.words,raw.words);assert.deepEqual(result.clips,raw.clips);assert.deepEqual({...result.sentenceTranslations},raw.sentenceTranslations);assert.deepEqual(result.selectedWordIds,['cat']);assert.equal(result.gap,500);assert.equal(result.repeats,2);
 assert.deepEqual({...cleanWeekly({...raw,words:'cat | 小猫 | A new sentence.'}).sentenceTranslations},{});
});
