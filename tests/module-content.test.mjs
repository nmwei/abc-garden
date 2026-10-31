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

import {completeLocalWords} from '../app/module-content.js';
test('local completion fills only missing fields and reports unknown words without guessing',()=>{
 const result=completeLocalWords('Apple\ncat | 小猫 | My cat is cute. | 指一指\nzzzzunknown');
 const words=parseWords(result.words);
 assert.equal(words[0].zh,'苹果');assert.equal(words[0].sentence,'I like apples.');
 assert.equal(words[1].zh,'小猫');assert.equal(words[1].sentence,'My cat is cute.');assert.equal(words[1].action,'指一指');
 assert.equal(words[2].zh,'');assert.equal(words[2].sentence,'');assert.deepEqual(result.missing,['zzzzunknown']);assert.equal(result.completed,1);
 assert.equal(completeLocalWords(result.words).words,result.words);
 assert.throws(()=>completeLocalWords('apple\nApple'));
 assert.equal(parseWords(completeLocalWords('cat | 家里的猫').words)[0].zh,'家里的猫');
});

import {lookupLocalWord,completionMeaning} from '../app/local-dictionary.js';
test('new picture cards upgrade exact prior dictionary output while preserving a custom meaning',()=>{
 const old=completionMeaning(lookupLocalWord('mix'));
 assert.deepEqual(parseWords(completeLocalWords(`mix | ${old}`).words)[0],{word:'mix',zh:'搅拌',sentence:'I can mix.',action:''});
 assert.equal(parseWords(completeLocalWords('mix | 混合颜料 | I mix colors.').words)[0].zh,'混合颜料');
});

import {WordEditor,wordRows,configWithRows,addWords} from '../app/word-editor.js';
test('word rows migrate legacy fields, bind translations to English and preserve legacy pacing',()=>{
 const config=cleanWeekly({words:'cat | 小猫 | My cat is cute. | 指一指',repeats:2,gap:500});const editor=new WordEditor(config);
 editor.update('cat','sentence',' My cat is cute. ');editor.update('cat','sentenceZh',' 我的猫很可爱。 ');const saved=cleanWeekly(configWithRows(config,editor.rows));assert.equal(saved.repeats,2);assert.equal(saved.gap,500);assert.equal(wordRows(saved)[0].sentenceZh,'我的猫很可爱。');assert.equal(wordRows(saved)[0].action,'指一指');
 editor.update('cat','sentence','The cat can jump.');assert.equal(editor.rows[0].sentenceZh,'');
 assert.equal(wordRows({...saved,words:'cat | 小猫 | A new sentence.'})[0].sentenceZh,'');
});
test('word-only batch addition deduplicates atomically, fills available text and keeps unknown fields empty',()=>{
 const added=addWords([],'Apple, apple\ncat\nzzzzunknown');assert.equal(added.rows.length,3);assert.equal(added.duplicates,1);assert.equal(added.rows[0].sentenceZh,'我喜欢苹果。');assert.equal(added.rows[2].sentenceZh,'');
 assert.throws(()=>addWords(added.rows,'apple | 苹果'));assert.throws(()=>addWords(added.rows,'abc123'));assert.equal(added.rows.length,3);
 assert.throws(()=>configWithRows({},[{...added.rows[0],sentence:'中文'}]));
});
