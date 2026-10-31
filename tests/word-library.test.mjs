import test from 'node:test';
import assert from 'node:assert/strict';
import {wordLibrary,selectedWordIds} from '../app/word-library.js';
import {READY_WORDS as WORDS} from '../app/course-content.js';
test('selection migrates known words in order, excludes unknowns and keeps catalog canonical',()=>{
 assert.deepEqual(selectedWordIds({words:'cat | 改写 | Hello.\napple\nzzzzunknown'}),['cat','apple']);
 assert.deepEqual(selectedWordIds({selectedWordIds:['apple','cat','apple','zzzzunknown'],words:'ball'}),['apple','cat']);
 assert.deepEqual(selectedWordIds({selectedWordIds:[],words:'ball'}),[]);
 assert.deepEqual(selectedWordIds({words:'cat\nbecause'}),['cat']);
 assert.deepEqual(selectedWordIds({selectedWordIds:['because']}),['because']);
 const lib=wordLibrary([{word:'cat',sentence:'changed'},{word:'apple'},{word:'cat'}]);assert.equal(lib.all,WORDS);assert.deepEqual(lib.selected.map(w=>w.id),['cat','apple']);assert.notEqual(lib.selected[0].sentence,'changed');
});

test('only pictured canonical cards are learnable; pending selections survive',()=>{
 assert.ok(wordLibrary().all.every(w=>w.image));
 assert.ok(!wordLibrary().all.some(w=>w.id==='colour'));
 assert.deepEqual(selectedWordIds({selectedWordIds:['per cent','percent','colour','color','because','cat']}),['percent','color','because','cat']);
 assert.deepEqual(wordLibrary([{word:'per cent'},{word:'colour'},{word:'color'},{word:'cat'}]).selected.map(w=>w.id),['color','cat']);
});
