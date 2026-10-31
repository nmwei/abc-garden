import test from 'node:test';
import assert from 'node:assert/strict';
import {wordLibrary} from '../app/word-library.js';
import {WORDS} from '../app/course-content.js';
test('one catalog deduplicates sources and preserves explicit parent overrides',()=>{
 const lib=wordLibrary([{word:'apple',zh:'自己的苹果',sentence:'',sentenceZh:''},{word:'zzzzunknown',zh:'自定义',sentence:'A new word.'}]);
 assert.equal(lib.all.length,WORDS.length+1);assert.equal(lib.all.filter(w=>w.id==='apple').length,1);
 const apple=lib.all.find(w=>w.id==='apple');assert.equal(apple.sentence,'');assert.equal(apple.zh,'自己的苹果');assert.ok(apple.image);assert.equal(apple.pictureCue,true);
 assert.equal(lib.custom[1].image,'');assert.equal(lib.builtin.find(w=>w.id==='apple'),apple);
});
